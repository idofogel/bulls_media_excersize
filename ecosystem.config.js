module.exports = {
  apps: [{
    name: 'app',
    script: './index.js',  // or your main server file
    instances: 10,      // use all available CPU cores
    exec_mode: 'cluster',  // enables load balancing
    out_file: '/logs/out.log',   // STDOUT
    error_file: '/logs/err.log', // STDERR
    log_file: '/logs/combined.log', // Combined (optional)
    merge_logs: true,
    env: {
      NODE_ENV: 'production'
    }
  }]
};