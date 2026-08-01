import http, { Server } from 'node:http';

export interface HealthDependency {
  name: string;
  isHealthy: () => boolean;
}

export interface HealthMonitor {
  stop: () => void;
}

export function startHealthMonitor(
  port: number,
  dependencies: HealthDependency[],
  unhealthyRestartAfterMs: number,
  onPersistentlyUnhealthy: () => void,
): HealthMonitor {
  let unhealthySince: number | null = Date.now();
  let restartTriggered = false;

  const getStatus = () => {
    const services = Object.fromEntries(
      dependencies.map(({ name, isHealthy }) => [name, isHealthy() ? 'connected' : 'disconnected']),
    );
    const healthy = Object.values(services).every((status) => status === 'connected');
    return { healthy, services };
  };

  const server: Server = http.createServer((request, response) => {
    if (request.url !== '/healthz') {
      response.writeHead(404).end();
      return;
    }

    const status = getStatus();
    response.writeHead(status.healthy ? 200 : 503, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: status.healthy ? 'ok' : 'unhealthy', ...status.services }));
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[Health] Listening on port ${port} (/healthz).`);
  });

  server.on('error', (error) => {
    console.error('[Health] Server error:', error);
    onPersistentlyUnhealthy();
  });

  const watchdog = setInterval(() => {
    if (getStatus().healthy) {
      unhealthySince = null;
      return;
    }

    unhealthySince ??= Date.now();
    if (!restartTriggered && Date.now() - unhealthySince >= unhealthyRestartAfterMs) {
      restartTriggered = true;
      console.error(`[Health] Dependencies have been unhealthy for ${unhealthyRestartAfterMs}ms; restarting process.`);
      onPersistentlyUnhealthy();
    }
  }, 5000);

  return {
    stop: () => {
      clearInterval(watchdog);
      server.close();
    },
  };
}
