import { useState, useEffect, useCallback, useRef } from "react";

export interface CallQualityStats {
  connectionState: RTCPeerConnectionState | "idle";
  iceConnectionState: RTCIceConnectionState | "idle";
  signalStrength: "excellent" | "good" | "fair" | "poor" | "unknown";
  latency: number | null; // in ms
  packetLoss: number | null; // percentage
  bitrate: number | null; // in kbps
  jitter: number | null; // in ms
  resolution: { width: number; height: number } | null;
  frameRate: number | null;
  // Auto-fallback info
  shouldFallbackToAudio: boolean;
  poorQualityStreak: number;

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
  connectionState: "idle",
  iceConnectionState: "idle",
  signalStrength: "unknown",
  latency: null,
  packetLoss: null,
  bitrate: null,
  jitter: null,
  resolution: null,
  frameRate: null,
  shouldFallbackToAudio: false,
  poorQualityStreak: 0,
  selectedCandidatePair: null,
};

// Thresholds for auto-fallback
const POOR_QUALITY_STREAK_THRESHOLD = 3; // 3 consecutive poor readings (6 seconds)
const PACKET_LOSS_THRESHOLD = 15; // 15% packet loss
const LATENCY_THRESHOLD = 500; // 500ms
const BITRATE_LOW_THRESHOLD = 100; // 100 kbps is too low for video

export function useCallQuality(peerConnection: RTCPeerConnection | null) {
  const [stats, setStats] = useState<CallQualityStats>(initialStats);
  const prevBytesReceived = useRef<number>(0);
  const prevTimestamp = useRef<number>(0);

  const calculateSignalStrength = useCallback(
    (
      packetLoss: number | null,
      latency: number | null,
      jitter: number | null,
    ): CallQualityStats["signalStrength"] => {
      if (packetLoss === null || latency === null) return "unknown";

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

      if (score >= 80) return "excellent";
      if (score >= 60) return "good";
      if (score >= 40) return "fair";
      return "poor";
    },
    [],
  );

  useEffect(() => {
    if (!peerConnection) {
      setStats(initialStats);
      return;
    }

    const updateStats = async () => {
      try {
        const report = await peerConnection.getStats();
        const newStats: Partial<CallQualityStats> = {
          connectionState: peerConnection.connectionState,
          iceConnectionState: peerConnection.iceConnectionState,
        };

        // We’ll resolve candidate IDs after we find the selected pair.
        // RTCStats candidate-pair fields are not fully typed in lib.dom.d.ts
        interface CandidatePairStat {
          selected?: boolean;
          nominated?: boolean;
          localCandidateId?: string;
          remoteCandidateId?: string;
          currentRoundTripTime?: number;
        }
        interface CandidateStat {
          candidateType?: string;
          protocol?: string;
          ip?: string;
          address?: string;
        }
        let selectedPair: (RTCStats & CandidatePairStat) | null = null;
        let localCandidateId: string | undefined;
        let remoteCandidateId: string | undefined;

        report.forEach((stat) => {
          // Get inbound RTP stats for audio/video
          if (stat.type === "inbound-rtp" && (stat.kind === "video" || stat.kind === "audio")) {
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
          if (stat.type === "inbound-rtp" && stat.kind === "video") {
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
          if (
            stat.type === "candidate-pair" &&
            (stat as RTCStats & { state?: string }).state === "succeeded"
          ) {
            // Modern browsers set either `selected` or `nominated` (or both).
            const pair = stat as RTCStats & CandidatePairStat;
            const isSelected = pair.selected === true || pair.nominated === true;
            if (isSelected && !selectedPair) {
              selectedPair = pair;
              localCandidateId = pair.localCandidateId;
              remoteCandidateId = pair.remoteCandidateId;

              if (pair.currentRoundTripTime !== undefined) {
                newStats.latency = Math.round(pair.currentRoundTripTime * 1000);
              }
            }
          }
        });

        // Resolve candidate details for the selected pair
        if (selectedPair && localCandidateId && remoteCandidateId) {
          const local = report.get(localCandidateId) as (RTCStats & CandidateStat) | undefined;
          const remote = report.get(remoteCandidateId) as (RTCStats & CandidateStat) | undefined;

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

        // Check if we should suggest fallback to audio (this tick's fresh readings)
        const isVideoQualityPoor =
          (newStats.packetLoss !== undefined &&
            newStats.packetLoss !== null &&
            newStats.packetLoss > PACKET_LOSS_THRESHOLD) ||
          (newStats.latency !== undefined &&
            newStats.latency !== null &&
            newStats.latency > LATENCY_THRESHOLD) ||
          (newStats.bitrate !== undefined &&
            newStats.bitrate !== null &&
            newStats.bitrate < BITRATE_LOW_THRESHOLD &&
            newStats.bitrate > 0);

        setStats((prev) => {
          // Derive the streak and signal strength from `prev` (not the effect
          // closure). The interval below keeps the same closure between effect
          // re-runs, so reading `stats.poorQualityStreak` would freeze the streak
          // whenever packetLoss/latency/jitter are stable — and the auto-fallback
          // (threshold 3) would never fire on a steadily-poor connection.
          const newPoorStreak = isVideoQualityPoor ? prev.poorQualityStreak + 1 : 0;
          return {
            ...prev,
            ...newStats,
            signalStrength: calculateSignalStrength(
              newStats.packetLoss ?? prev.packetLoss,
              newStats.latency ?? prev.latency,
              newStats.jitter ?? prev.jitter,
            ),
            poorQualityStreak: newPoorStreak,
            shouldFallbackToAudio: newPoorStreak >= POOR_QUALITY_STREAK_THRESHOLD,
          };
        });
      } catch (error) {
        console.error("Error getting WebRTC stats:", error);
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

    peerConnection.addEventListener("connectionstatechange", handleConnectionChange);
    peerConnection.addEventListener("iceconnectionstatechange", handleConnectionChange);

    return () => {
      clearInterval(interval);
      peerConnection.removeEventListener("connectionstatechange", handleConnectionChange);
      peerConnection.removeEventListener("iceconnectionstatechange", handleConnectionChange);
    };
  }, [peerConnection, calculateSignalStrength]);

  return stats;
}
