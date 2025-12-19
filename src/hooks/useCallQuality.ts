import { useState, useEffect, useCallback, useRef } from 'react';

export interface CallQualityStats {
  connectionState: RTCPeerConnectionState | 'idle';
  iceConnectionState: RTCIceConnectionState | 'idle';
  signalStrength: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  latency: number | null; // in ms
  packetLoss: number | null; // percentage
  bitrate: number | null; // in kbps
  jitter: number | null; // in ms
  resolution: { width: number; height: number } | null;
  frameRate: number | null;

  // Debug details
  selectedCandidatePair: {
    localType?: string;
    remoteType?: string;
    protocol?: string;
    rttMs?: number;
    localAddress?: string;
    remoteAddress?: string;
  } | null;
}

const initialStats: CallQualityStats = {
  connectionState: 'idle',
  iceConnectionState: 'idle',
  signalStrength: 'unknown',
  latency: null,
  packetLoss: null,
  bitrate: null,
  jitter: null,
  resolution: null,
  frameRate: null,
  selectedCandidatePair: null,
};

export function useCallQuality(peerConnection: RTCPeerConnection | null) {
  const [stats, setStats] = useState<CallQualityStats>(initialStats);
  const prevBytesReceived = useRef<number>(0);
  const prevTimestamp = useRef<number>(0);

  const calculateSignalStrength = useCallback((
    packetLoss: number | null,
    latency: number | null,
    jitter: number | null
  ): CallQualityStats['signalStrength'] => {
    if (packetLoss === null || latency === null) return 'unknown';
    
    // Calculate quality score based on multiple factors
    let score = 100;
    
    // Packet loss impact (0-5% is good, >10% is poor)
    if (packetLoss > 10) score -= 40;
    else if (packetLoss > 5) score -= 25;
    else if (packetLoss > 2) score -= 10;
    
    // Latency impact (<100ms excellent, 100-200 good, 200-400 fair, >400 poor)
    if (latency > 400) score -= 40;
    else if (latency > 200) score -= 25;
    else if (latency > 100) score -= 10;
    
    // Jitter impact
    if (jitter !== null) {
      if (jitter > 100) score -= 20;
      else if (jitter > 50) score -= 10;
      else if (jitter > 30) score -= 5;
    }
    
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }, []);

  useEffect(() => {
    if (!peerConnection) {
      setStats(initialStats);
      return;
    }

    const updateStats = async () => {
      try {
        const report = await peerConnection.getStats();
        let newStats: Partial<CallQualityStats> = {
          connectionState: peerConnection.connectionState,
          iceConnectionState: peerConnection.iceConnectionState,
        };

        // We’ll resolve candidate IDs after we find the selected pair.
        let selectedPair: any | null = null;
        let localCandidateId: string | undefined;
        let remoteCandidateId: string | undefined;

        report.forEach((stat) => {
          // Get inbound RTP stats for audio/video
          if (stat.type === 'inbound-rtp' && (stat.kind === 'video' || stat.kind === 'audio')) {
            const packetsLost = stat.packetsLost || 0;
            const packetsReceived = stat.packetsReceived || 0;
            const totalPackets = packetsLost + packetsReceived;

            if (totalPackets > 0) {
              newStats.packetLoss = Math.round((packetsLost / totalPackets) * 100 * 100) / 100;
            }

            if (stat.jitter !== undefined) {
              newStats.jitter = Math.round(stat.jitter * 1000 * 100) / 100;
            }

            // Calculate bitrate
            if (stat.bytesReceived !== undefined && stat.timestamp) {
              const bytesReceived = stat.bytesReceived;
              const timestamp = stat.timestamp;

              if (prevBytesReceived.current > 0 && prevTimestamp.current > 0) {
                const timeDiff = (timestamp - prevTimestamp.current) / 1000;
                const bytesDiff = bytesReceived - prevBytesReceived.current;
                if (timeDiff > 0) {
                  newStats.bitrate = Math.round((bytesDiff * 8) / timeDiff / 1000);
                }
              }

              prevBytesReceived.current = bytesReceived;
              prevTimestamp.current = timestamp;
            }
          }

          // Get video track stats for resolution and frame rate
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            if (stat.frameWidth && stat.frameHeight) {
              newStats.resolution = {
                width: stat.frameWidth,
                height: stat.frameHeight,
              };
            }
            if (stat.framesPerSecond !== undefined) {
              newStats.frameRate = Math.round(stat.framesPerSecond);
            }
          }

          // Find the *selected* candidate pair (best for "why doesn't this connect")
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
            // Modern browsers set either `selected` or `nominated` (or both).
            const isSelected = (stat as any).selected === true || (stat as any).nominated === true;
            if (isSelected && !selectedPair) {
              selectedPair = stat;
              localCandidateId = (stat as any).localCandidateId;
              remoteCandidateId = (stat as any).remoteCandidateId;

              if ((stat as any).currentRoundTripTime !== undefined) {
                newStats.latency = Math.round(((stat as any).currentRoundTripTime as number) * 1000);
              }
            }
          }
        });

        // Resolve candidate details for the selected pair
        if (selectedPair && localCandidateId && remoteCandidateId) {
          const local = report.get(localCandidateId) as any;
          const remote = report.get(remoteCandidateId) as any;

          newStats.selectedCandidatePair = {
            localType: local?.candidateType,
            remoteType: remote?.candidateType,
            protocol: local?.protocol || remote?.protocol,
            rttMs: newStats.latency ?? null,
            localAddress: local?.ip || local?.address,
            remoteAddress: remote?.ip || remote?.address,
          };
        } else {
          newStats.selectedCandidatePair = null;
        }

        // Calculate signal strength
        newStats.signalStrength = calculateSignalStrength(
          newStats.packetLoss ?? stats.packetLoss,
          newStats.latency ?? stats.latency,
          newStats.jitter ?? stats.jitter
        );

        setStats((prev) => ({ ...prev, ...newStats }));
      } catch (error) {
        console.error('Error getting WebRTC stats:', error);
      }
    };

    // Initial update
    updateStats();

    // Update stats every 2 seconds
    const interval = setInterval(updateStats, 2000);

    // Listen for connection state changes
    const handleConnectionChange = () => {
      setStats((prev) => ({
        ...prev,
        connectionState: peerConnection.connectionState,
        iceConnectionState: peerConnection.iceConnectionState,
      }));
    };

    peerConnection.addEventListener('connectionstatechange', handleConnectionChange);
    peerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange);

    return () => {
      clearInterval(interval);
      peerConnection.removeEventListener('connectionstatechange', handleConnectionChange);
      peerConnection.removeEventListener('iceconnectionstatechange', handleConnectionChange);
    };
  }, [peerConnection, calculateSignalStrength, stats.packetLoss, stats.latency, stats.jitter]);

  return stats;
}
