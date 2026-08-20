<?php

namespace App\Http\Controllers;

use App\Models\Ingreso;
use App\Models\Product;
use App\Models\ProductSale;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ProductSaleController extends Controller
{
    public function sell(Request $request, Product $product)
    {
        $data = $request->validate([
            'quantity'       => 'required|integer|min:1',
            'member_id'      => ['nullable', $this->existsInGym('members')],
            'payment_method' => 'required|in:cash,card,transfer',
            'amount_paid'    => 'nullable|numeric|min:0',
            'date'           => 'nullable|date|before_or_equal:today',
            'notes'          => 'nullable|string|max:1000',
        ]);

        $connection = $this->isPaid() ? 'tenant' : config('database.default');
        $date       = $data['date'] ?? now()->toDateString();

        $sale = \DB::connection($connection)->transaction(function () use ($data, $product, $connection, $date) {
            return $this->processSaleItem(
                $connection, $product->id, $data['quantity'], $data['payment_method'],
                $data['member_id'] ?? null, $date, $data['notes'] ?? null, $data['amount_paid'] ?? null
            );
        });

        $sale->load('member:id,first_name,last_name,member_code');
        $this->recordIngresoAndNotify($sale, $product->name);

        return response()->json($sale, 201);
    }

    /**
     * Multi-product checkout: sells several products in a single transaction
     * (a cart) — all items commit together, or none do, if any item runs
     * out of stock mid-cart.
     */
    public function checkout(Request $request)
    {
        $data = $request->validate([
            'items'               => 'required|array|min:1|max:50',
            'items.*.product_id'  => ['required', 'integer', $this->existsInGym('products')],
            'items.*.quantity'    => 'required|integer|min:1',
            'member_id'           => ['nullable', $this->existsInGym('members')],
            'payment_method'      => 'required|in:cash,card,transfer',
            'amount_paid'         => 'nullable|numeric|min:0',
            'date'                => 'nullable|date|before_or_equal:today',
            'notes'               => 'nullable|string|max:1000',
        ]);

        $connection = $this->isPaid() ? 'tenant' : config('database.default');
        $date       = $data['date'] ?? now()->toDateString();
        $memberId   = $data['member_id'] ?? null;

        $sales = \DB::connection($connection)->transaction(function () use ($data, $connection, $date, $memberId) {
            $created = [];
            foreach ($data['items'] as $item) {
                // amount_paid reflects what the customer handed over for the whole cart,
                // so it's recorded on every line item — same duplication pattern already
                // used for payment_method/date across a multi-item checkout.
                $created[] = $this->processSaleItem(
                    $connection, $item['product_id'], $item['quantity'], $data['payment_method'],
                    $memberId, $date, $data['notes'] ?? null, $data['amount_paid'] ?? null
                );
            }
            return $created;
        });

        $grandTotal = 0;
        foreach ($sales as $sale) {
            $sale->load('product:id,name', 'member:id,first_name,last_name,member_code');
            $grandTotal += (float) $sale->total_amount;
            $this->recordIngresoAndNotify($sale, $sale->product->name);
        }

        return response()->json([
            'sales'        => $sales,
            'items_count'  => count($sales),
            'total_amount' => round($grandTotal, 2),
        ], 201);
    }

    public function index(Request $request)
    {
        $query = ProductSale::with(['product:id,name,sku,image_path', 'member:id,first_name,last_name,member_code']);

        if ($productId = $request->get('product_id')) {
            $query->where('product_id', $productId);
        }

        if ($memberId = $request->get('member_id')) {
            $query->where('member_id', $memberId);
        }

        if ($month = $request->get('month')) {
            $query->whereRaw("DATE_FORMAT(date, '%Y-%m') = ?", [$month]);
        }

        if ($from = $request->get('from')) {
            $query->where('date', '>=', $from);
        }

        if ($to = $request->get('to')) {
            $query->where('date', '<=', $to);
        }

        $this->applySort($query, $request, ['date', 'quantity', 'total_amount', 'profit', 'payment_method'], 'date', 'desc');
        $sales = $query->orderByDesc('created_at')->paginate($request->get('per_page', 12));

        return response()->json($sales);
    }

    /**
     * Row-locks the product, checks/decrements stock, and creates the
     * ProductSale row. Must always be called from inside a transaction on
     * $connection — callers may batch several of these together (checkout)
     * so that either the whole cart sells or none of it does.
     */
    private function processSaleItem(
        string $connection, int $productId, int $quantity, string $paymentMethod,
        ?int $memberId, string $date, ?string $notes, ?float $amountPaid = null
    ): ProductSale {
        $locked = Product::on($connection)->where('id', $productId)->lockForUpdate()->first();

        if (! $locked) {
            throw ValidationException::withMessages(['items' => ['Uno de los productos ya no existe.']]);
        }

        if (! $locked->unlimited_stock) {
            if ($locked->stock === null || $locked->stock < $quantity) {
                throw ValidationException::withMessages([
                    'quantity' => ["Stock insuficiente para \"{$locked->name}\". Disponible: " . ($locked->stock ?? 0) . '.'],
                ]);
            }
            $locked->decrement('stock', $quantity);
        }

        $unitPrice   = (float) $locked->price;
        $unitCost    = (float) $locked->cost;
        $totalAmount = round($unitPrice * $quantity, 2);
        $totalCost   = round($unitCost * $quantity, 2);

        return ProductSale::create([
            'product_id'     => $locked->id,
            'member_id'      => $memberId,
            'quantity'       => $quantity,
            'unit_price'     => $unitPrice,
            'unit_cost'      => $unitCost,
            'total_amount'   => $totalAmount,
            'total_cost'     => $totalCost,
            'profit'         => round($totalAmount - $totalCost, 2),
            'amount_paid'    => $amountPaid,
            'payment_method' => $paymentMethod,
            'sold_by'        => auth()->id(),
            'date'           => $date,
            'notes'          => $notes,
        ]);
    }

    /**
     * A finance-ledger hiccup must never roll back a completed sale —
     * mirrors VisitController::store()'s resilience pattern.
     */
    private function recordIngresoAndNotify(ProductSale $sale, string $productName): void
    {
        try {
            $concept = "Venta: {$productName} x{$sale->quantity}";

            Ingreso::create([
                'member_id'      => $sale->member_id,
                'concept'        => $concept,
                'amount'         => $sale->total_amount,
                'payment_method' => $sale->payment_method,
                'origin'         => 'product',
                'reference_id'   => $sale->id,
                'reference_type' => 'product_sale',
                'date'           => $sale->date->format('Y-m-d'),
            ]);

            $gymId = auth()->user()->gym_id;
            if ($gymId) {
                $memberName = $sale->member ? "{$sale->member->first_name} {$sale->member->last_name}" : null;
                NotificationService::paymentReceived($gymId, $sale->member_id, $memberName, (float) $sale->total_amount, $concept);
            }
        } catch (\Throwable $e) {
            \Log::warning("Ingreso auto-insert failed (product sale {$sale->id}): " . $e->getMessage());
        }
    }
}
