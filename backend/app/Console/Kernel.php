<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        // Suspende gyms vencidos (free trial y suscripciones pagas) todos los días a medianoche
        $schedule->command('gyms:suspend-expired')->dailyAt('00:00');

        // Notificaciones de membresías próximas a vencer o ya vencidas
        $schedule->command('notifications:membership-expiry')->dailyAt('08:00');

        // Felicitaciones de cumpleaños (correo solo si el gym lo habilitó)
        $schedule->command('notifications:birthdays')->dailyAt('09:00');

        // Alertas de stock bajo (solo gyms con el feature de productos y la alerta habilitada)
        $schedule->command('notifications:low-stock')->dailyAt('08:30');

        // Elimina tokens Sanctum expirados (expiración configurada en 8h)
        $schedule->command('sanctum:prune-expired --hours=8')->dailyAt('03:00');
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
