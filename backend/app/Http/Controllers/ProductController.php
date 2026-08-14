<?php

namespace App\Http\Controllers;

use App\Exceptions\ImageValidationException;
use App\Models\Product;
use App\Models\ProductSale;
use App\Services\ImageUploadService;
use App\Services\ProductSkuService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductController extends Controller
{
    public function __construct(private ImageUploadService $images)
    {
    }

    public function index(Request $request)
    {
        $query = Product::query();

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('sku', 'like', "%{$search}%");
            });
        }

        if ($category = $request->get('category')) {
            $query->where('category', $category);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($request->boolean('low_stock')) {
            $query->lowStock();
        }

        if ($request->boolean('out_of_stock')) {
            $query->outOfStock();
        }

        $products = $query->withSum('sales as units_sold', 'quantity')
            ->orderBy('name')
            ->paginate($request->get('per_page', 24));

        return response()->json($products);
    }

    public function show(Product $product)
    {
        return response()->json($product);
    }

    public function store(Request $request)
    {
        $data = $this->validateProduct($request);

        if (empty($data['sku'])) {
            $data['sku'] = ProductSkuService::generate($data['name']);
        }

        if ($request->hasFile('image')) {
            try {
                $gymId = auth()->user()->gym_id;
                $data['image_path'] = $this->images->processAndStore($request->file('image'), "products/{$gymId}");
            } catch (ImageValidationException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        $product = Product::create($data);

        return response()->json($product, 201);
    }

    public function update(Request $request, Product $product)
    {
        $data = $this->validateProduct($request, $product->id);

        if (empty($data['sku'])) {
            $data['sku'] = ProductSkuService::generate($data['name'] ?? $product->name);
        }

        if ($request->hasFile('image')) {
            try {
                $gymId = auth()->user()->gym_id;
                $newPath = $this->images->processAndStore($request->file('image'), "products/{$gymId}");
            } catch (ImageValidationException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }

            $this->images->delete($product->image_path);
            $data['image_path'] = $newPath;
        }

        $product->update($data);

        return response()->json($product);
    }

    public function destroy(Product $product)
    {
        if ($product->sales()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar un producto con ventas registradas. Márcalo como inactivo en su lugar.',
            ], 422);
        }

        $this->images->delete($product->image_path);
        $product->delete();

        return response()->json(['message' => 'Producto eliminado correctamente.']);
    }

    public function summary()
    {
        $totalProducts  = Product::count();
        $activeProducts = Product::where('status', 'active')->count();
        $lowStockCount  = Product::lowStock()->count();
        $outOfStockCount = Product::outOfStock()->count();

        $inventoryValue = (float) Product::whereNotNull('stock')
            ->selectRaw('COALESCE(SUM(price * stock), 0) as v')->value('v');
        $inventoryCost = (float) Product::whereNotNull('stock')
            ->selectRaw('COALESCE(SUM(cost * stock), 0) as v')->value('v');

        $now       = now();
        $salesBase = ProductSale::query();

        $totalRevenue = (float) (clone $salesBase)->sum('total_amount');
        $totalProfit  = (float) (clone $salesBase)->sum('profit');
        $monthProfit  = (float) (clone $salesBase)
            ->whereMonth('date', $now->month)->whereYear('date', $now->year)->sum('profit');
        $unitsSold    = (int) (clone $salesBase)->sum('quantity');

        $topProductsRaw = ProductSale::select('product_id', DB::raw('SUM(quantity) as units'), DB::raw('SUM(total_amount) as revenue'))
            ->groupBy('product_id')
            ->orderByDesc('units')
            ->limit(5)
            ->get();
        $productMap = Product::whereIn('id', $topProductsRaw->pluck('product_id'))->get(['id', 'name'])->keyBy('id');
        $topProducts = $topProductsRaw->map(fn ($r) => [
            'product_id' => $r->product_id,
            'name'       => $productMap[$r->product_id]->name ?? '—',
            'units'      => (int) $r->units,
            'revenue'    => (float) $r->revenue,
        ]);

        $byCategory = Product::whereNotNull('category')
            ->select('category', DB::raw('COUNT(*) as count'))
            ->groupBy('category')
            ->orderByDesc('count')
            ->get();

        return response()->json([
            'total_products'    => $totalProducts,
            'active_products'   => $activeProducts,
            'low_stock_count'   => $lowStockCount,
            'out_of_stock_count' => $outOfStockCount,
            'inventory_value'   => $inventoryValue,
            'inventory_cost'    => $inventoryCost,
            'total_revenue'     => $totalRevenue,
            'total_profit'      => $totalProfit,
            'month_profit'      => $monthProfit,
            'units_sold'        => $unitsSold,
            'top_products'      => $topProducts,
            'by_category'       => $byCategory,
        ]);
    }

    public function stats(Product $product)
    {
        $base = ProductSale::where('product_id', $product->id);

        $salesCount   = (clone $base)->count();
        $unitsSold    = (int) (clone $base)->sum('quantity');
        $totalRevenue = (float) (clone $base)->sum('total_amount');
        $totalCost    = (float) (clone $base)->sum('total_cost');
        $totalProfit  = (float) (clone $base)->sum('profit');
        $avgSale      = $salesCount > 0 ? round($totalRevenue / $salesCount, 2) : 0;

        $startDate = now()->copy()->startOfMonth()->subMonths(5);
        $byMonthRaw = (clone $base)->where('date', '>=', $startDate)
            ->select(
                DB::raw('YEAR(date) as year'),
                DB::raw('MONTH(date) as month'),
                DB::raw('SUM(quantity) as units'),
                DB::raw('SUM(total_amount) as revenue'),
                DB::raw('SUM(profit) as profit')
            )
            ->groupBy('year', 'month')
            ->orderBy('year')->orderBy('month')
            ->get();
        $byMonth = $byMonthRaw->map(fn ($r) => [
            'year'    => (int) $r->year,
            'month'   => (int) $r->month,
            'units'   => (int) $r->units,
            'revenue' => (float) $r->revenue,
            'profit'  => (float) $r->profit,
        ]);

        $byMethod = (clone $base)
            ->select('payment_method', DB::raw('SUM(total_amount) as total'), DB::raw('COUNT(*) as count'))
            ->groupBy('payment_method')
            ->get()
            ->map(fn ($r) => ['method' => $r->payment_method, 'total' => (float) $r->total, 'count' => (int) $r->count]);

        $recentSales = ProductSale::with('member:id,first_name,last_name,member_code')
            ->where('product_id', $product->id)
            ->orderByDesc('date')->orderByDesc('created_at')
            ->limit(15)
            ->get()
            ->map(fn ($s) => [
                'id'             => $s->id,
                'member'         => $s->member ? "{$s->member->first_name} {$s->member->last_name}" : null,
                'member_code'    => $s->member?->member_code,
                'quantity'       => $s->quantity,
                'unit_price'     => (float) $s->unit_price,
                'total_amount'   => (float) $s->total_amount,
                'profit'         => (float) $s->profit,
                'payment_method' => $s->payment_method,
                'date'           => $s->date->format('Y-m-d'),
            ]);

        $price  = (float) $product->price;
        $margin = $price > 0 ? round((($price - (float) $product->cost) / $price) * 100, 1) : 0;

        return response()->json([
            'product'         => $product,
            'sales_count'     => $salesCount,
            'units_sold'      => $unitsSold,
            'total_revenue'   => $totalRevenue,
            'total_cost'      => $totalCost,
            'total_profit'    => $totalProfit,
            'avg_sale_amount' => $avgSale,
            'margin_percent'  => $margin,
            'by_month'        => $byMonth,
            'by_method'       => $byMethod,
            'recent_sales'    => $recentSales,
        ]);
    }

    private function validateProduct(Request $request, ?int $ignoreId = null): array
    {
        $data = $request->validate([
            'name'                 => 'required|string|max:150',
            'description'          => 'nullable|string|max:2000',
            'sku'                  => ['nullable', 'string', 'max:60', $this->uniqueForGym('products', 'sku', $ignoreId)],
            'category'             => 'nullable|string|max:100',
            'price'                => 'required|numeric|min:0|max:999999.99',
            'cost'                 => 'nullable|numeric|min:0|max:999999.99',
            'stock'                => 'nullable|integer|min:0',
            'low_stock_threshold'  => 'nullable|integer|min:0',
            'status'               => 'nullable|in:active,inactive',
        ]);

        // FormData sends booleans as the strings "true"/"false", which Laravel's
        // strict `boolean` validation rule rejects — coerce leniently instead.
        $data['unlimited_stock'] = $request->boolean('unlimited_stock');

        return $data;
    }
}
