<?php

namespace Database\Seeders;

use App\Models\ClassSchedule;
use App\Models\ClassSession;
use App\Models\DiscountCategory;
use App\Models\Gym;
use App\Models\GymClass;
use App\Models\Ingreso;
use App\Models\Member;
use App\Models\Membership;
use App\Models\MembershipType;
use App\Models\Product;
use App\Models\ProductSale;
use App\Models\Setting;
use App\Models\Trainer;
use App\Models\User;
use App\Models\Visit;
use App\Services\MemberCodeService;
use App\Services\ProductSkuService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DemoGymSeeder extends Seeder
{
    public function run(): void
    {
        // Create demo gym
        $gym = Gym::create([
            'name' => 'FitLife Gym',
            'code' => 'FIT',
            'plan' => 'premium',
            'plan_type' => 'free',
            'db_name' => null,
            'status' => 'active',
            'billing_status' => 'active',
            'subscription_starts_at' => Carbon::now(),
            'subscription_ends_at' => Carbon::now()->addMonths(3),
        ]);

        $this->command->info("Gym creado: {$gym->name} (ID: {$gym->id}, Code: {$gym->code})");

        // Create admin user
        $admin = User::create([
            'gym_id' => $gym->id,
            'username' => 'admin',
            'first_name' => 'Carlos',
            'paternal_surname' => 'Rodríguez',
            'maternal_surname' => 'García',
            'email' => 'admin@fitlife.demo',
            'password' => Hash::make('password123'),
            'role' => 'admin',
            'access_code' => 'FIT-ADMIN',
            'access_code_plain' => 'FIT-ADMIN',
            'access_code_changes' => 0,
            'onboarding_completed' => true,
            'account_status' => 'active',
            'extended_access' => 0,
        ]);

        // Create trainer user (role must be 'user' per DB enum)
        $trainerUser = User::create([
            'gym_id' => $gym->id,
            'username' => 'trainer1',
            'first_name' => 'Miguel',
            'paternal_surname' => 'Torres',
            'maternal_surname' => 'López',
            'email' => 'trainer@fitlife.demo',
            'password' => Hash::make('password123'),
            'role' => 'user',
            'access_code' => 'FIT-TRNR',
            'access_code_plain' => 'FIT-TRNR',
            'access_code_changes' => 0,
            'onboarding_completed' => true,
            'account_status' => 'active',
            'extended_access' => 0,
        ]);

        // Create receptionist user (role must be 'user' per DB enum)
        $receptionUser = User::create([
            'gym_id' => $gym->id,
            'username' => 'reception',
            'first_name' => 'Ana',
            'paternal_surname' => 'Martínez',
            'maternal_surname' => 'Sánchez',
            'email' => 'reception@fitlife.demo',
            'password' => Hash::make('password123'),
            'role' => 'user',
            'access_code' => 'FIT-RECP',
            'access_code_plain' => 'FIT-RECP',
            'access_code_changes' => 0,
            'onboarding_completed' => true,
            'account_status' => 'active',
            'extended_access' => 0,
        ]);

        $this->command->info('Usuarios creados: admin, trainer, reception (password: password123)');

        // Create default settings
        $settings = [
            ['key' => 'gym_name', 'value' => 'FitLife Gym', 'type' => 'string', 'group' => 'general', 'label' => 'Nombre del gimnasio'],
            ['key' => 'gym_phone', 'value' => '+34 912 345 678', 'type' => 'string', 'group' => 'general', 'label' => 'Teléfono'],
            ['key' => 'gym_email', 'value' => 'info@fitlife.demo', 'type' => 'string', 'group' => 'general', 'label' => 'Email'],
            ['key' => 'gym_address', 'value' => 'Calle Mayor 123, 28001 Madrid', 'type' => 'string', 'group' => 'general', 'label' => 'Dirección'],
            ['key' => 'theme_color', 'value' => 'emerald', 'type' => 'string', 'group' => 'appearance', 'label' => 'Color del tema'],
            ['key' => 'dark_mode', 'value' => 'false', 'type' => 'boolean', 'group' => 'appearance', 'label' => 'Modo oscuro'],
            ['key' => 'price_visit_daily', 'value' => '10.00', 'type' => 'decimal', 'group' => 'pricing', 'label' => 'Precio visita diaria'],
            ['key' => 'price_visit_weekly', 'value' => '50.00', 'type' => 'decimal', 'group' => 'pricing', 'label' => 'Precio visita semanal'],
            ['key' => 'price_visit_monthly', 'value' => '150.00', 'type' => 'decimal', 'group' => 'pricing', 'label' => 'Precio visita mensual'],
            ['key' => 'price_membership_basic', 'value' => '89.00', 'type' => 'decimal', 'group' => 'pricing', 'label' => 'Membresía básica mensual'],
            ['key' => 'price_membership_premium', 'value' => '149.00', 'type' => 'decimal', 'group' => 'pricing', 'label' => 'Membresía premium mensual'],
            ['key' => 'price_membership_annual', 'value' => '1200.00', 'type' => 'decimal', 'group' => 'pricing', 'label' => 'Membresía anual'],
            ['key' => 'currency', 'value' => 'EUR', 'type' => 'string', 'group' => 'pricing', 'label' => 'Moneda'],
            ['key' => 'receipt_footer', 'value' => 'Gracias por su visita - FitLife Gym', 'type' => 'string', 'group' => 'receipts', 'label' => 'Pie de recibo'],
            ['key' => 'whatsapp_enabled', 'value' => 'false', 'type' => 'boolean', 'group' => 'notifications', 'label' => 'WhatsApp habilitado'],
            ['key' => 'auto_backup', 'value' => 'true', 'type' => 'boolean', 'group' => 'system', 'label' => 'Backup automático'],
        ];

        foreach ($settings as $setting) {
            Setting::create(array_merge($setting, ['gym_id' => $gym->id]));
        }

        // Create membership types
        $membershipTypes = [
            ['name' => 'Básica', 'color' => '#3B82F6'],      // Blue
            ['name' => 'Premium', 'color' => '#8B5CF6'],     // Purple
            ['name' => 'Estudiante', 'color' => '#10B981'],  // Emerald
            ['name' => 'Familiar', 'color' => '#F59E0B'],    // Amber
            ['name' => 'Corporativa', 'color' => '#EF4444'], // Red
        ];

        foreach ($membershipTypes as $mt) {
            MembershipType::create(array_merge($mt, ['gym_id' => $gym->id]));
        }

        // Create discount categories
        $discountCategories = [
            ['name' => 'Estudiante', 'discount_percent' => 20.00],
            ['name' => 'Senior (+60)', 'discount_percent' => 15.00],
            ['name' => 'Familiar (2+)', 'discount_percent' => 10.00],
            ['name' => 'Corporativo', 'discount_percent' => 15.00],
            ['name' => 'Promoción Invierno', 'discount_percent' => 25.00],
        ];

        foreach ($discountCategories as $dc) {
            DiscountCategory::create(array_merge($dc, ['gym_id' => $gym->id]));
        }

        // Create trainers
        $trainers = [
            [
                'gym_id' => $gym->id,
                'user_id' => $trainerUser->id,
                'first_name' => 'Miguel',
                'last_name' => 'Torres',
                'email' => 'miguel.torres@fitlife.demo',
                'phone' => '+34 600 111 222',
                'specialty' => 'CrossFit / Fuerza',
                'certifications' => 'NSCA-CPT, CrossFit Level 2',
                'bio' => 'Especialista en entrenamiento funcional y fuerza. 8 años de experiencia.',
                'hire_date' => Carbon::now()->subMonths(18),
                'status' => 'active',
            ],
            [
                'gym_id' => $gym->id,
                'user_id' => null,
                'first_name' => 'Laura',
                'last_name' => 'González',
                'email' => 'laura.gonzalez@fitlife.demo',
                'phone' => '+34 600 333 444',
                'specialty' => 'Yoga / Pilates',
                'certifications' => 'RYT-500, Pilates Mat Certificado',
                'bio' => 'Instructora de yoga y pilates con enfoque en movilidad y bienestar.',
                'hire_date' => Carbon::now()->subMonths(12),
                'status' => 'active',
            ],
            [
                'gym_id' => $gym->id,
                'user_id' => null,
                'first_name' => 'Roberto',
                'last_name' => 'Fernández',
                'email' => 'roberto.fernandez@fitlife.demo',
                'phone' => '+34 600 555 666',
                'specialty' => 'Spinning / Cardio',
                'certifications' => 'Spinning Master Instructor, Les Mills',
                'bio' => 'Entrenador de clases grupales de alta intensidad. Energía garantizada.',
                'hire_date' => Carbon::now()->subMonths(6),
                'status' => 'active',
            ],
        ];

        $trainerModels = [];
        foreach ($trainers as $t) {
            $trainerModels[] = Trainer::create($t);
        }

        // Create gym classes
        $classes = [
            [
                'gym_id' => $gym->id,
                'name' => 'CrossFit WOD',
                'description' => 'Entrenamiento funcional de alta intensidad variado constantemente.',
                'trainer_id' => $trainerModels[0]->id,
                'capacity' => 20,
                'duration' => 60,
                'difficulty' => 'Alta',
                'type' => 'group',
                'start_date' => Carbon::now()->startOfWeek(),
            ],
            [
                'gym_id' => $gym->id,
                'name' => 'Yoga Vinyasa Flow',
                'description' => 'Flujo dinámico de posturas sincronizado con la respiración.',
                'trainer_id' => $trainerModels[1]->id,
                'capacity' => 25,
                'duration' => 75,
                'difficulty' => 'Media',
                'type' => 'group',
                'start_date' => Carbon::now()->startOfWeek(),
            ],
            [
                'gym_id' => $gym->id,
                'name' => 'Spinning Power',
                'description' => 'Clase de ciclismo indoor con intervalos de alta intensidad.',
                'trainer_id' => $trainerModels[2]->id,
                'capacity' => 30,
                'duration' => 45,
                'difficulty' => 'Alta',
                'type' => 'group',
                'start_date' => Carbon::now()->startOfWeek(),
            ],
            [
                'gym_id' => $gym->id,
                'name' => 'Pilates Reformer',
                'description' => 'Trabajo de core, flexibilidad y alineación en reformer.',
                'trainer_id' => $trainerModels[1]->id,
                'capacity' => 10,
                'duration' => 60,
                'difficulty' => 'Media',
                'type' => 'group',
                'start_date' => Carbon::now()->startOfWeek(),
            ],
            [
                'gym_id' => $gym->id,
                'name' => 'Entrenamiento Personal',
                'description' => 'Sesión 1 a 1 adaptada a tus objetivos.',
                'trainer_id' => $trainerModels[0]->id,
                'capacity' => 1,
                'duration' => 60,
                'difficulty' => 'Personalizada',
                'type' => 'personal',
                'start_date' => Carbon::now()->startOfWeek(),
            ],
        ];

        $classModels = [];
        foreach ($classes as $c) {
            $classModels[] = GymClass::create($c);
        }

        // Create class schedules (weekly recurring)
        $schedules = [
            // CrossFit: Mon/Wed/Fri 7:00, 19:00
            ['class_id' => $classModels[0]->id, 'day_of_week' => 1, 'start_time' => '07:00', 'end_time' => '08:00', 'room' => 'Sala CrossFit'],
            ['class_id' => $classModels[0]->id, 'day_of_week' => 3, 'start_time' => '07:00', 'end_time' => '08:00', 'room' => 'Sala CrossFit'],
            ['class_id' => $classModels[0]->id, 'day_of_week' => 5, 'start_time' => '07:00', 'end_time' => '08:00', 'room' => 'Sala CrossFit'],
            ['class_id' => $classModels[0]->id, 'day_of_week' => 1, 'start_time' => '19:00', 'end_time' => '20:00', 'room' => 'Sala CrossFit'],
            ['class_id' => $classModels[0]->id, 'day_of_week' => 3, 'start_time' => '19:00', 'end_time' => '20:00', 'room' => 'Sala CrossFit'],
            ['class_id' => $classModels[0]->id, 'day_of_week' => 5, 'start_time' => '19:00', 'end_time' => '20:00', 'room' => 'Sala CrossFit'],

            // Yoga: Tue/Thu 8:00, Sat 10:00
            ['class_id' => $classModels[1]->id, 'day_of_week' => 2, 'start_time' => '08:00', 'end_time' => '09:15', 'room' => 'Sala Zen'],
            ['class_id' => $classModels[1]->id, 'day_of_week' => 4, 'start_time' => '08:00', 'end_time' => '09:15', 'room' => 'Sala Zen'],
            ['class_id' => $classModels[1]->id, 'day_of_week' => 6, 'start_time' => '10:00', 'end_time' => '11:15', 'room' => 'Sala Zen'],

            // Spinning: Mon/Wed/Fri 18:00, Tue/Thu 7:00
            ['class_id' => $classModels[2]->id, 'day_of_week' => 1, 'start_time' => '18:00', 'end_time' => '18:45', 'room' => 'Sala Spinning'],
            ['class_id' => $classModels[2]->id, 'day_of_week' => 3, 'start_time' => '18:00', 'end_time' => '18:45', 'room' => 'Sala Spinning'],
            ['class_id' => $classModels[2]->id, 'day_of_week' => 5, 'start_time' => '18:00', 'end_time' => '18:45', 'room' => 'Sala Spinning'],
            ['class_id' => $classModels[2]->id, 'day_of_week' => 2, 'start_time' => '07:00', 'end_time' => '07:45', 'room' => 'Sala Spinning'],
            ['class_id' => $classModels[2]->id, 'day_of_week' => 4, 'start_time' => '07:00', 'end_time' => '07:45', 'room' => 'Sala Spinning'],

            // Pilates: Mon/Thu 10:00
            ['class_id' => $classModels[3]->id, 'day_of_week' => 1, 'start_time' => '10:00', 'end_time' => '11:00', 'room' => 'Sala Pilates'],
            ['class_id' => $classModels[3]->id, 'day_of_week' => 4, 'start_time' => '10:00', 'end_time' => '11:00', 'room' => 'Sala Pilates'],

            // Personal training: Flexible
            ['class_id' => $classModels[4]->id, 'day_of_week' => 0, 'start_time' => '09:00', 'end_time' => '10:00', 'room' => 'Sala PT'],
            ['class_id' => $classModels[4]->id, 'day_of_week' => 0, 'start_time' => '11:00', 'end_time' => '12:00', 'room' => 'Sala PT'],
        ];

        foreach ($schedules as $s) {
            ClassSchedule::create(array_merge($s, ['gym_id' => $gym->id]));
        }

        // Create class sessions for the next 4 weeks
        $sessionNumber = 1;
        foreach ($classModels as $class) {
            for ($week = 0; $week < 4; $week++) {
                foreach ($class->schedules as $schedule) {
                    $sessionDate = Carbon::now()->startOfWeek()->addWeeks($week)->addDays($schedule->day_of_week);
                    if ($sessionDate->isPast()) {
                        $sessionDate = $sessionDate->addWeek();
                    }
                    ClassSession::create([
                        'gym_id' => $gym->id,
                        'class_id' => $class->id,
                        'schedule_id' => $schedule->id,
                        'session_number' => $sessionNumber++,
                        'date' => $sessionDate->format('Y-m-d'),
                        'start_time' => $schedule->start_time,
                        'end_time' => $schedule->end_time,
                        'status' => $sessionDate->isPast() ? 'completed' : 'scheduled',
                        'trainer_id' => $class->trainer_id,
                    ]);
                }
            }
        }

        // Create demo members (15 members)
        $memberData = [
            ['first_name' => 'María', 'last_name' => 'García', 'email' => 'maria.garcia@email.com', 'phone' => '+34 611 111 111', 'birth_date' => '1990-03-15', 'gender' => 'F', 'membership_type' => 'Premium', 'discount_category' => null, 'status' => 'active'],
            ['first_name' => 'Juan', 'last_name' => 'López', 'email' => 'juan.lopez@email.com', 'phone' => '+34 622 222 222', 'birth_date' => '1985-07-22', 'gender' => 'M', 'membership_type' => 'Básica', 'discount_category' => 'Estudiante', 'status' => 'active'],
            ['first_name' => 'Carmen', 'last_name' => 'Martínez', 'email' => 'carmen.martinez@email.com', 'phone' => '+34 633 333 333', 'birth_date' => '1992-11-08', 'gender' => 'F', 'membership_type' => 'Premium', 'discount_category' => null, 'status' => 'active'],
            ['first_name' => 'David', 'last_name' => 'Rodríguez', 'email' => 'david.rodriguez@email.com', 'phone' => '+34 644 444 444', 'birth_date' => '1988-01-30', 'gender' => 'M', 'membership_type' => 'Familiar', 'discount_category' => 'Familiar (2+)', 'status' => 'active'],
            ['first_name' => 'Laura', 'last_name' => 'Fernández', 'email' => 'laura.fernandez@email.com', 'phone' => '+34 655 555 555', 'birth_date' => '1995-05-17', 'gender' => 'F', 'membership_type' => 'Estudiante', 'discount_category' => 'Estudiante', 'status' => 'active'],
            ['first_name' => 'Carlos', 'last_name' => 'González', 'email' => 'carlos.gonzalez@email.com', 'phone' => '+34 666 666 666', 'birth_date' => '1982-09-12', 'gender' => 'M', 'membership_type' => 'Corporativa', 'discount_category' => 'Corporativo', 'status' => 'active'],
            ['first_name' => 'Ana', 'last_name' => 'Sánchez', 'email' => 'ana.sanchez@email.com', 'phone' => '+34 677 777 777', 'birth_date' => '1991-12-03', 'gender' => 'F', 'membership_type' => 'Premium', 'discount_category' => null, 'status' => 'active'],
            ['first_name' => 'Pablo', 'last_name' => 'Ramírez', 'email' => 'pablo.ramirez@email.com', 'phone' => '+34 688 888 888', 'birth_date' => '1987-04-25', 'gender' => 'M', 'membership_type' => 'Básica', 'discount_category' => null, 'status' => 'active'],
            ['first_name' => 'Isabel', 'last_name' => 'Torres', 'email' => 'isabel.torres@email.com', 'phone' => '+34 699 999 999', 'birth_date' => '1960-02-14', 'gender' => 'F', 'membership_type' => 'Básica', 'discount_category' => 'Senior (+60)', 'status' => 'active'],
            ['first_name' => 'Javier', 'last_name' => 'Flores', 'email' => 'javier.flores@email.com', 'phone' => '+34 600 000 111', 'birth_date' => '1993-08-19', 'gender' => 'M', 'membership_type' => 'Premium', 'discount_category' => 'Promoción Invierno', 'status' => 'active'],
            ['first_name' => 'Elena', 'last_name' => 'Morales', 'email' => 'elena.morales@email.com', 'phone' => '+34 600 000 222', 'birth_date' => '1989-06-07', 'gender' => 'F', 'membership_type' => 'Familiar', 'discount_category' => 'Familiar (2+)', 'status' => 'active'],
            ['first_name' => 'Sergio', 'last_name' => 'Herrera', 'email' => 'sergio.herrera@email.com', 'phone' => '+34 600 000 333', 'birth_date' => '1994-10-11', 'gender' => 'M', 'membership_type' => 'Estudiante', 'discount_category' => 'Estudiante', 'status' => 'active'],
            ['first_name' => 'Patricia', 'last_name' => 'Jiménez', 'email' => 'patricia.jimenez@email.com', 'phone' => '+34 600 000 444', 'birth_date' => '1986-01-28', 'gender' => 'F', 'membership_type' => 'Premium', 'discount_category' => null, 'status' => 'active'],
            ['first_name' => 'Andrés', 'last_name' => 'Ruiz', 'email' => 'andres.ruiz@email.com', 'phone' => '+34 600 000 555', 'birth_date' => '1996-03-05', 'gender' => 'M', 'membership_type' => 'Básica', 'discount_category' => null, 'status' => 'active'],
            ['first_name' => 'Rosa', 'last_name' => 'Díaz', 'email' => 'rosa.diaz@email.com', 'phone' => '+34 600 000 666', 'birth_date' => '1958-07-16', 'gender' => 'F', 'membership_type' => 'Básica', 'discount_category' => 'Senior (+60)', 'status' => 'active'],
        ];

        $memberModels = [];
        foreach ($memberData as $index => $data) {
            $code = MemberCodeService::gymPrefix() . '-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT);
            $member = Member::create([
                'gym_id' => $gym->id,
                'user_id' => null,
                'member_code' => $code,
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'birth_date' => $data['birth_date'],
                'gender' => $data['gender'],
                'address' => 'Calle Demo ' . ($index + 1) . ', Madrid',
                'emergency_contact_name' => 'Contacto ' . $data['first_name'],
                'emergency_contact_phone' => '+34 600 999 ' . str_pad($index + 1, 3, '0', STR_PAD_LEFT),
                'membership_type' => $data['membership_type'],
                'discount_category' => $data['discount_category'],
                'membership_start' => Carbon::now()->subMonths(rand(1, 6)),
                'membership_end' => Carbon::now()->addMonths(rand(1, 12)),
                'status' => $data['status'],
                'qr_token' => bin2hex(random_bytes(16)),
            ]);
            $memberModels[] = $member;
        }

        // Create memberships for members
        $membershipPlans = [
            'Básica' => ['amount' => 89.00, 'duration' => 1],
            'Premium' => ['amount' => 149.00, 'duration' => 1],
            'Estudiante' => ['amount' => 69.00, 'duration' => 1],
            'Familiar' => ['amount' => 250.00, 'duration' => 1],
            'Corporativa' => ['amount' => 199.00, 'duration' => 1],
        ];

        foreach ($memberModels as $member) {
            $plan = $membershipPlans[$member->membership_type] ?? $membershipPlans['Básica'];
            $startDate = $member->membership_start;
            $endDate = $member->membership_end;

            Membership::create([
                'gym_id' => $gym->id,
                'member_id' => $member->id,
                'type' => $member->membership_type,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'amount' => $plan['amount'],
                'amount_paid' => $plan['amount'],
                'payment_method' => 'card',
                'status' => 'active',
            ]);
        }

        // Create products
        $products = [
            ['name' => 'Proteína Whey 2kg', 'description' => 'Proteína de suero sabor chocolate', 'sku' => null, 'category' => 'Suplementos', 'price' => 49.90, 'cost' => 30.00, 'stock' => 50, 'unlimited_stock' => false, 'low_stock_threshold' => 10, 'status' => 'active'],
            ['name' => 'Creatina Monohidrato 300g', 'description' => 'Creatina pura sin sabor', 'sku' => null, 'category' => 'Suplementos', 'price' => 19.90, 'cost' => 12.00, 'stock' => 80, 'unlimited_stock' => false, 'low_stock_threshold' => 15, 'status' => 'active'],
            ['name' => 'Pre-Entreno 300g', 'description' => 'Energía y foco para entrenamientos', 'sku' => null, 'category' => 'Suplementos', 'price' => 29.90, 'cost' => 18.00, 'stock' => 40, 'unlimited_stock' => false, 'low_stock_threshold' => 8, 'status' => 'active'],
            ['name' => 'Toalla Microfibra', 'description' => 'Toalla deportiva absorbente', 'sku' => null, 'category' => 'Accesorios', 'price' => 12.90, 'cost' => 7.00, 'stock' => 100, 'unlimited_stock' => false, 'low_stock_threshold' => 20, 'status' => 'active'],
            ['name' => 'Botella Agua 750ml', 'description' => 'Botella deportiva libre BPA', 'sku' => null, 'category' => 'Accesorios', 'price' => 8.90, 'cost' => 4.50, 'stock' => 120, 'unlimited_stock' => false, 'low_stock_threshold' => 25, 'status' => 'active'],
            ['name' => 'Guantes Gimnasio', 'description' => 'Guantes de agarre transpirables', 'sku' => null, 'category' => 'Accesorios', 'price' => 15.90, 'cost' => 9.00, 'stock' => 60, 'unlimited_stock' => false, 'low_stock_threshold' => 12, 'status' => 'active'],
            ['name' => 'Cinturón Lumbar', 'description' => 'Soporte lumbar para levantamiento', 'sku' => null, 'category' => 'Accesorios', 'price' => 24.90, 'cost' => 14.00, 'stock' => 30, 'unlimited_stock' => false, 'low_stock_threshold' => 6, 'status' => 'active'],
            ['name' => 'Bandas Resistencia Set', 'description' => '5 bandas de diferentes resistencias', 'sku' => null, 'category' => 'Accesorios', 'price' => 22.90, 'cost' => 13.00, 'stock' => 45, 'unlimited_stock' => false, 'low_stock_threshold' => 10, 'status' => 'active'],
            ['name' => 'Barrita Proteica (x12)', 'description' => 'Pack 12 barritas sabor variado', 'sku' => null, 'category' => 'Nutrición', 'price' => 18.90, 'cost' => 11.00, 'stock' => 70, 'unlimited_stock' => false, 'low_stock_threshold' => 15, 'status' => 'active'],
            ['name' => 'Electrolitos Polvo 500g', 'description' => 'Recuperación hidratación', 'sku' => null, 'category' => 'Suplementos', 'price' => 16.90, 'cost' => 10.00, 'stock' => 55, 'unlimited_stock' => false, 'low_stock_threshold' => 12, 'status' => 'active'],
        ];

        $productModels = [];
        foreach ($products as $p) {
            $sku = ProductSkuService::generate($p['name']);
            $product = Product::create([
                'gym_id' => $gym->id,
                'name' => $p['name'],
                'description' => $p['description'],
                'sku' => $sku,
                'category' => $p['category'],
                'price' => $p['price'],
                'cost' => $p['cost'],
                'stock' => $p['stock'],
                'unlimited_stock' => $p['unlimited_stock'],
                'low_stock_threshold' => $p['low_stock_threshold'],
                'status' => $p['status'],
            ]);
            $productModels[] = $product;
        }

        // Create visits (last 30 days, variety)
        $visitTypes = ['daily', 'weekly', 'monthly', 'class'];
        $paymentMethods = ['cash', 'card', 'transfer'];

        foreach ($memberModels as $member) {
            $visitsCount = rand(5, 20);
            for ($i = 0; $i < $visitsCount; $i++) {
                $visitDate = Carbon::now()->subDays(rand(0, 30))->setTime(rand(6, 21), rand(0, 59));
                $type = $visitTypes[array_rand($visitTypes)];
                $price = match($type) {
                    'daily' => 10.00,
                    'weekly' => 50.00,
                    'monthly' => 150.00,
                    'class' => 15.00,
                    default => 10.00,
                };

                $classId = null;
                $trainerId = null;
                if ($type === 'class') {
                    $classId = $classModels[array_rand($classModels)]->id;
                    $trainerId = $trainerModels[array_rand($trainerModels)]->id;
                }

                Visit::create([
                    'gym_id' => $gym->id,
                    'member_id' => $member->id,
                    'visit_date' => $visitDate,
                    'visit_type' => $type,
                    'class_id' => $classId,
                    'trainer_id' => $trainerId,
                    'notes' => $type === 'class' ? 'Clase grupal' : 'Entrenamiento libre',
                    'price' => $price,
                    'payment_method' => $paymentMethods[array_rand($paymentMethods)],
                    'amount_paid' => $price,
                ]);
            }
        }

        // Create product sales
        foreach ($productModels as $product) {
            $salesCount = rand(3, 15);
            for ($i = 0; $i < $salesCount; $i++) {
                $quantity = rand(1, 3);
                $saleDate = Carbon::now()->subDays(rand(0, 30));

                ProductSale::create([
                    'gym_id' => $gym->id,
                    'product_id' => $product->id,
                    'member_id' => $memberModels[array_rand($memberModels)]->id,
                    'quantity' => $quantity,
                    'unit_price' => $product->price,
                    'total' => $product->price * $quantity,
                    'payment_method' => $paymentMethods[array_rand($paymentMethods)],
                    'sale_date' => $saleDate,
                ]);

                // Decrease stock
                $product->decrement('stock', $quantity);
            }
        }

        // Create ingresos (revenue records)
        $concepts = [
            ['concept' => 'Membresía mensual', 'origin' => 'membership'],
            ['concept' => 'Visita diaria', 'origin' => 'visit'],
            ['concept' => 'Clase grupal', 'origin' => 'visit'],
            ['concept' => 'Venta producto', 'origin' => 'product'],
            ['concept' => 'Entrenamiento personal', 'origin' => 'visit'],
        ];

        foreach ($memberModels as $member) {
            $ingresosCount = rand(3, 8);
            for ($i = 0; $i < $ingresosCount; $i++) {
                $concept = $concepts[array_rand($concepts)];
                $amount = match($concept['origin']) {
                    'membership' => rand(69, 250),
                    'visit' => rand(10, 150),
                    'product' => rand(8, 50),
                    default => 50,
                };

                Ingreso::create([
                    'gym_id' => $gym->id,
                    'member_id' => $member->id,
                    'concept' => $concept['concept'],
                    'amount' => $amount,
                    'payment_method' => $paymentMethods[array_rand($paymentMethods)],
                    'origin' => $concept['origin'],
                    'reference_id' => null,
                    'reference_type' => null,
                    'date' => Carbon::now()->subDays(rand(0, 30)),
                    'notes' => 'Generado automáticamente para demo',
                ]);
            }
        }

        // Create labels
        $labels = [
            ['name' => 'VIP', 'color' => '#F59E0B'],
            ['name' => 'Competidor', 'color' => '#EF4444'],
            ['name' => 'Rehabilitación', 'color' => '#3B82F6'],
            ['name' => 'Embarazada', 'color' => '#EC4899'],
            ['name' => 'Nuevo', 'color' => '#10B981'],
        ];

        $labelModels = [];
        foreach ($labels as $l) {
            $labelModels[] = \App\Models\Label::create(array_merge($l, ['gym_id' => $gym->id]));
        }

        // Assign some labels to members
        foreach ($memberModels as $member) {
            if (rand(1, 10) <= 4) { // 40% chance
                $randomLabels = $labelModels->random(rand(1, 2));
                $member->labels()->attach($randomLabels->pluck('id'));
            }
        }

        $this->command->info('Datos de demostración creados exitosamente:');
        $this->command->info("- Gym: {$gym->name} (ID: {$gym->id})");
        $this->command->info("- 3 usuarios (admin, trainer, reception)");
        $this->command->info("- 15 miembros con membresías activas");
        $this->command->info("- 5 tipos de membresía con colores");
        $this->command->info("- 5 categorías de descuento");
        $this->command->info("- 3 entrenadores");
        $this->command->info("- 5 clases con horarios semanales y sesiones a 4 semanas");
        $this->command->info("- 10 productos con stock");
        $this->command->info("- Visitas, ventas, ingresos y etiquetas variadas");
        $this->command->info("");
        $this->command->info("Credenciales de acceso:");
        $this->command->info("  Admin: admin@fitlife.demo / password123");
        $this->command->info("  Trainer: trainer@fitlife.demo / password123");
        $this->command->info("  Reception: reception@fitlife.demo / password123");
    }
}