import React, { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Server,
  Database
} from 'lucide-react';

const LivePerformanceMonitor = ({ socket, sessionId }) => {
  const [metrics, setMetrics] = useState({
    cpu: 0,
    memory: 0,
    network: 0,
    buildTime: 0,
    activeUsers: 0,
    serverLoad: 0,
    errorRate: 0,
    responseTime: 0
  });

  const [history, setHistory] = useState({
    cpu: [],
    memory: [],
    network: [],
    responseTime: []
  });

  const [alerts, setAlerts] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (socket) {
      socket.on('performance_metrics', (data) => {
        setMetrics(data);
        
        // Update history (keep last 50 data points)
        setHistory(prev => ({
          cpu: [...prev.cpu.slice(-49), data.cpu],
          memory: [...prev.memory.slice(-49), data.memory],
          network: [...prev.network.slice(-49), data.network],
          responseTime: [...prev.responseTime.slice(-49), data.responseTime]
        }));

        // Check for alerts
        checkForAlerts(data);
      });

      socket.on('performance_alert', (alert) => {
        setAlerts(prev => [...prev.slice(-9), {
          id: Date.now(),
          ...alert,
          timestamp: new Date().toLocaleTimeString()
        }]);
      });

      return () => {
        socket.off('performance_metrics');
        socket.off('performance_alert');
      };
    }
  }, [socket]);

  const checkForAlerts = (data) => {
    const newAlerts = [];

    if (data.cpu > 80) {
      newAlerts.push({
        type: 'warning',
        message: `High CPU usage: ${data.cpu}%`,
        metric: 'cpu'
      });
    }

    if (data.memory > 85) {
      newAlerts.push({
        type: 'error',
        message: `High memory usage: ${data.memory}%`,
        metric: 'memory'
      });
    }

    if (data.responseTime > 1000) {
      newAlerts.push({
        type: 'warning',
        message: `Slow response time: ${data.responseTime}ms`,
        metric: 'responseTime'
      });
    }

    if (data.errorRate > 5) {
      newAlerts.push({
        type: 'error',
        message: `High error rate: ${data.errorRate}%`,
        metric: 'errorRate'
      });
    }

    newAlerts.forEach(alert => {
      setAlerts(prev => [...prev.slice(-9), {
        id: Date.now() + Math.random(),
        ...alert,
        timestamp: new Date().toLocaleTimeString()
      }]);
    });
  };

  const startMonitoring = () => {
    if (socket) {
      socket.emit('start_performance_monitoring', { sessionId });
      setIsMonitoring(true);
    }
  };

  const stopMonitoring = () => {
    if (socket) {
      socket.emit('stop_performance_monitoring', { sessionId });
      setIsMonitoring(false);
    }
  };

  const getStatusColor = (value, thresholds) => {
    if (value < thresholds.good) return 'text-green-400';
    if (value < thresholds.warning) return 'text-yellow-400';
    return 'text-red-400';
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const MetricCard = ({ icon: Icon, title, value, unit, color, trend, subtitle }) => (
    <div className="bg-surface-secondary p-4 rounded-lg border border-border-primary">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className={color} />
          <span className="text-sm font-medium text-text-primary">{title}</span>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 ${trend > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span className="text-xs">{Math.abs(trend)}%</span>
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-text-primary">{value}</span>
        <span className="text-sm text-text-tertiary">{unit}</span>
      </div>
      {subtitle && (
        <p className="text-xs text-text-tertiary mt-1">{subtitle}</p>
      )}
    </div>
  );

  const MiniChart = ({ data, color = 'rgb(34, 197, 94)' }) => {
    const max = Math.max(...data, 1);
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - (value / max) * 100;
      return `${x},${y}`;
    }).join(' ');

    return (
      <div className="h-8 w-full">
        <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2"
            className="opacity-80"
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-surface-primary">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-primary bg-surface-secondary">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-blue-400" />
          <span className="font-medium text-text-primary">Performance Monitor</span>
          {isMonitoring && (
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
            className={`btn-sm px-3 py-1 rounded transition-colors ${
              isMonitoring 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isMonitoring ? 'Stop' : 'Start'} Monitoring
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* Main Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            icon={Cpu}
            title="CPU Usage"
            value={metrics.cpu}
            unit="%"
            color={getStatusColor(metrics.cpu, { good: 50, warning: 75 })}
            trend={history.cpu.length > 1 ? 
              ((metrics.cpu - history.cpu[history.cpu.length - 2]) / history.cpu[history.cpu.length - 2] * 100).toFixed(1) : 0
            }
          />
          
          <MetricCard
            icon={HardDrive}
            title="Memory"
            value={metrics.memory}
            unit="%"
            color={getStatusColor(metrics.memory, { good: 60, warning: 80 })}
            trend={history.memory.length > 1 ? 
              ((metrics.memory - history.memory[history.memory.length - 2]) / history.memory[history.memory.length - 2] * 100).toFixed(1) : 0
            }
          />
          
          <MetricCard
            icon={Wifi}
            title="Network"
            value={metrics.network.toFixed(1)}
            unit="MB/s"
            color="text-cyan-400"
            subtitle="Avg bandwidth usage"
          />
          
          <MetricCard
            icon={Clock}
            title="Response Time"
            value={metrics.responseTime}
            unit="ms"
            color={getStatusColor(metrics.responseTime, { good: 200, warning: 500 })}
            subtitle="Avg server response"
          />
        </div>

        {/* Additional Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            icon={Users}
            title="Active Users"
            value={metrics.activeUsers}
            unit="users"
            color="text-purple-400"
            subtitle="Currently online"
          />
          
          <MetricCard
            icon={Server}
            title="Server Load"
            value={metrics.serverLoad.toFixed(2)}
            unit=""
            color={getStatusColor(metrics.serverLoad * 100, { good: 50, warning: 75 })}
            subtitle="System load average"
          />
          
          <MetricCard
            icon={AlertTriangle}
            title="Error Rate"
            value={metrics.errorRate.toFixed(1)}
            unit="%"
            color={getStatusColor(metrics.errorRate, { good: 1, warning: 3 })}
            subtitle="Request error rate"
          />
          
          <MetricCard
            icon={Zap}
            title="Build Time"
            value={metrics.buildTime.toFixed(1)}
            unit="s"
            color="text-indigo-400"
            subtitle="Last build duration"
          />
        </div>

        {/* Performance Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-surface-secondary p-4 rounded-lg border border-border-primary">
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <Cpu size={14} className="text-blue-400" />
              CPU Usage History
            </h3>
            <MiniChart data={history.cpu} color="rgb(59, 130, 246)" />
            <div className="flex justify-between text-xs text-text-tertiary mt-2">
              <span>0%</span>
              <span>Current: {metrics.cpu}%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="bg-surface-secondary p-4 rounded-lg border border-border-primary">
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <HardDrive size={14} className="text-green-400" />
              Memory Usage History
            </h3>
            <MiniChart data={history.memory} color="rgb(34, 197, 94)" />
            <div className="flex justify-between text-xs text-text-tertiary mt-2">
              <span>0%</span>
              <span>Current: {metrics.memory}%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        {alerts.length > 0 && (
          <div className="bg-surface-secondary p-4 rounded-lg border border-border-primary">
            <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
              <AlertTriangle size={14} className="text-yellow-400" />
              Recent Alerts
            </h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {alerts.slice(-5).map(alert => (
                <div key={alert.id} className={`flex items-center gap-2 text-xs p-2 rounded ${
                  alert.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'
                }`}>
                  {alert.type === 'error' ? 
                    <AlertTriangle size={12} /> : 
                    <CheckCircle size={12} />
                  }
                  <span className="flex-1">{alert.message}</span>
                  <span className="text-text-tertiary">{alert.timestamp}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LivePerformanceMonitor;
