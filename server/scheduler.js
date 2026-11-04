// Background Task Scheduler & Automated Monitoring
// Menggantikan kebutuhan queue worker eksternal (seperti Redis) dengan timer internal Node.js.
// Bertugas menjalankan health check 5 menit sekali, monitoring jadwal pemutakhiran data OPD,
// dan pembersihan berkas/token kedaluwarsa.

import os from 'os';

export function inisialisasiScheduler(app, pool, queryDB) {
  const state = {
    started_at: new Date().toISOString(),
    jobs: {
      health_check: {
        interval_ms: 5 * 60 * 1000, // 5 menit
        last_run: null,
        next_run: null,
        status: 'idle',
        run_count: 0,
        errors: 0,
      },
      pemutakhiran_checker: {
        interval_ms: 60 * 60 * 1000, // 1 jam
        last_run: null,
        next_run: null,
        status: 'idle',
        run_count: 0,
        errors: 0,
      },
      pruning_maintenance: {
        interval_ms: 6 * 60 * 60 * 1000, // 6 jam
        last_run: null,
        next_run: null,
        status: 'idle',
        run_count: 0,
        errors: 0,
      },
    },
    health_history: [],
  };

  // Helper simpan riwayat health check
  const catatHealth = (item) => {
    state.health_history.unshift(item);
    if (state.health_history.length > 20) state.health_history.pop();
  };

  // 1. Job: System Health Check (Setiap 5 menit)
  const jalankanHealthCheck = async () => {
    const job = state.jobs.health_check;
    job.status = 'running';
    job.last_run = new Date().toISOString();
    job.next_run = new Date(Date.now() + job.interval_ms).toISOString();
    job.run_count++;

    const start = Date.now();
    try {
      // Test koneksi database
      const dbRes = await queryDB('SELECT 1 AS ping, NOW() AS db_time');
      const dbLatency = Date.now() - start;
      const mem = process.memoryUsage();

      const result = {
        timestamp: new Date().toISOString(),
        status: 'healthy',
        database: {
          ok: true,
          latency_ms: dbLatency,
          db_time: dbRes[0]?.db_time,
        },
        system: {
          uptime_seconds: Math.floor(process.uptime()),
          heap_used_mb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
          heap_total_mb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
          rss_mb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
          freemem_mb: Math.round((os.freemem() / 1024 / 1024) * 100) / 100,
          totalmem_mb: Math.round((os.totalmem() / 1024 / 1024) * 100) / 100,
        },
      };

      catatHealth(result);
      job.status = 'success';
      return result;
    } catch (err) {
      job.status = 'error';
      job.errors++;
      const errResult = {
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        error: err.message,
      };
      catatHealth(errResult);
      console.error('[Scheduler] Health check gagal:', err.message);
      return errResult;
    }
  };

  // 2. Job: Pemutakhiran Jadwal & Reminder OPD
  const jalankanPemutakhiranChecker = async () => {
    const job = state.jobs.pemutakhiran_checker;
    job.status = 'running';
    job.last_run = new Date().toISOString();
    job.next_run = new Date(Date.now() + job.interval_ms).toISOString();
    job.run_count++;

    try {
      // Periksa dataset yang memiliki jadwal pemutakhiran aktif
      const targetDatasets = await queryDB(`
        SELECT d.id, d.nama, d.opd_id, o.nama AS opd_nama, d.jadwal_pemutakhiran, d.jadwal_pemutakhiran_akhir, d.status
          FROM bank_dataset d
          JOIN bank_data_opd o ON o.id = d.opd_id
         WHERE d.jadwal_pemutakhiran_akhir IS NOT NULL
           AND d.jadwal_pemutakhiran_akhir >= CURRENT_DATE
           AND d.jadwal_pemutakhiran_akhir <= CURRENT_DATE + INTERVAL '3 days'
           AND d.status != 'disetujui'
         LIMIT 20
      `);

      // Buat pengingat di tabel notifikasi untuk OPD yang mendekati batas waktu
      for (const ds of targetDatasets) {
        const pesan = `Peringatan: Jadwal pemutakhiran data '${ds.nama}' untuk ${ds.opd_nama} mendekati batas akhir (${ds.jadwal_pemutakhiran_akhir}). Harap segera lengkapi dan ajukan data.`;
        await queryDB(
          `INSERT INTO notifications (user_id, message, read, created_at)
           SELECT u.id, $1, false, NOW()
             FROM user_list u
             JOIN user_credentials c ON c.nip = u."NIP"
            WHERE c.opd_id = $2
              AND NOT EXISTS (
                SELECT 1 FROM notifications n
                 WHERE n.user_id = u.id
                   AND n.message LIKE $3
                   AND n.created_at >= CURRENT_DATE
              )
           LIMIT 5`,
          [pesan, ds.opd_id, `%${ds.nama}%`]
        ).catch(() => {});
      }

      job.status = 'success';
      return { datasets_checked: targetDatasets.length };
    } catch (err) {
      job.status = 'error';
      job.errors++;
      console.error('[Scheduler] Pemutakhiran checker error:', err.message);
      return { error: err.message };
    }
  };

  // 3. Job: Maintenance & Pruning Token Kedaluwarsa
  const jalankanPruning = async () => {
    const job = state.jobs.pruning_maintenance;
    job.status = 'running';
    job.last_run = new Date().toISOString();
    job.next_run = new Date(Date.now() + job.interval_ms).toISOString();
    job.run_count++;

    try {
      // Hapus token reset password kedaluwarsa
      await queryDB(`
        DELETE FROM sd_password_reset_token
         WHERE expires_at < NOW()
      `).catch(() => {});

      job.status = 'success';
      return { pruned: true };
    } catch (err) {
      job.status = 'error';
      job.errors++;
      return { error: err.message };
    }
  };

  // Jalankan health check pertama kali saat server start
  setTimeout(jalankanHealthCheck, 3000);
  setTimeout(jalankanPemutakhiranChecker, 10000);

  // Daftarkan interval
  const timerHealth = setInterval(jalankanHealthCheck, state.jobs.health_check.interval_ms);
  const timerPemutakhiran = setInterval(jalankanPemutakhiranChecker, state.jobs.pemutakhiran_checker.interval_ms);
  const timerPruning = setInterval(jalankanPruning, state.jobs.pruning_maintenance.interval_ms);

  // Jangan blokir process shutdown
  if (timerHealth.unref) timerHealth.unref();
  if (timerPemutakhiran.unref) timerPemutakhiran.unref();
  if (timerPruning.unref) timerPruning.unref();

  // Endpoint Monitoring Scheduler untuk Admin
  app.get('/api/monitoring/scheduler', async (_, res) => {
    const mem = process.memoryUsage();
    res.json({
      scheduler_active: true,
      started_at: state.started_at,
      uptime_seconds: Math.floor(process.uptime()),
      memory: {
        heap_used_mb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
        heap_total_mb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        rss_mb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
      },
      jobs: state.jobs,
      recent_health_checks: state.health_history.slice(0, 10),
    });
  });

  // Endpoint Trigger Manual untuk Uji Coba Scheduler
  app.post('/api/monitoring/scheduler/run', async (req, res) => {
    const { job_name } = req.body || {};
    let result = {};

    if (job_name === 'health_check' || !job_name) {
      result.health_check = await jalankanHealthCheck();
    }
    if (job_name === 'pemutakhiran_checker' || !job_name) {
      result.pemutakhiran_checker = await jalankanPemutakhiranChecker();
    }
    if (job_name === 'pruning' || !job_name) {
      result.pruning = await jalankanPruning();
    }

    res.json({
      message: 'Scheduler task berhasil dipicu secara manual',
      result,
      jobs: state.jobs,
    });
  });
}

