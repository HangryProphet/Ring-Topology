/**
 * Updates the text of the theme toggle button based on the current theme.
 */
function updateThemeToggleText() {
  const button = document.getElementById("themeToggle");
  if (document.body.classList.contains("dark-theme")) {
    button.textContent = "☀️ LIGHT MODE";
  } else {
    button.textContent = "🌙 DARK MODE";
  }
}

/**
 * Updates the source and target node dropdown selectors in the UI.
 */
function updateNodeSelectors() {
  const sourceSelect = document.getElementById("sourceNode");
  const targetSelect = document.getElementById("targetNode");
  
  const sourceVal = sourceSelect.value;
  const targetVal = targetSelect.value;
  
  sourceSelect.innerHTML = '<option value="">Select Source Node</option>';
  targetSelect.innerHTML = '<option value="">Select Target Node</option>';
  
  for (let i = 1; i <= nodeCount; i++) {
    const nodeId = `node${i}`;
    const nodeIP = ipConfigurations[nodeId] || generateIP(i);
    const isActive = nodeStatus[nodeId];
    const statusIcon = isActive ? "🟢" : "🔴";
    
    sourceSelect.innerHTML += `<option value="${nodeId}">${statusIcon} PC ${i} (${nodeIP})</option>`;
    targetSelect.innerHTML += `<option value="${nodeId}">${statusIcon} PC ${i} (${nodeIP})</option>`;
  }
  
  // Restore previous selections if still valid
  if (sourceVal && data.nodes.get(sourceVal)) sourceSelect.value = sourceVal;
  if (targetVal && data.nodes.get(targetVal)) targetSelect.value = targetVal;
}

/**
 * Adds a log entry to the packet log display.
 * @param {string} message - The log message (can contain HTML).
 * @param {string} [type="info"] - The type of log entry (e.g., "info", "error", "source", "target").
 */
function addLogEntry(message, type = "info") {
  const logContainer = document.getElementById("packetLog");
  const time = new Date().toLocaleTimeString();
  
  const entry = document.createElement("div");
  entry.className = `log-entry ${type}`;
  
  const timeSpan = document.createElement("div");
  timeSpan.className = "log-time";
  timeSpan.textContent = time;
  
  const messageDiv = document.createElement("div");
  messageDiv.innerHTML = message;
  
  entry.appendChild(timeSpan);
  entry.appendChild(messageDiv);
  
  packetLogEntries.push(entry);
  if (packetLogEntries.length > 100) {
    const removed = packetLogEntries.shift();
    if (removed.parentNode) removed.parentNode.removeChild(removed);
  }
  
  logContainer.innerHTML = "";
  packetLogEntries.forEach(item => {
    logContainer.appendChild(item);
  });
  
  logContainer.scrollTop = logContainer.scrollHeight;
}

/**
 * Updates the main status text display based on network state.
 */
function updateStatusText() {
  const statusEl = document.getElementById("status");
  const ringStatusBox = document.getElementById("ringStatus");
  const health = checkNetworkHealth();
  
  if (!health.ringIntact) {
    statusEl.innerHTML = `NODES: ${health.activeNodes}/${health.totalNodes} | TOKEN: 🔴 INACTIVE | HEALTH: ${health.healthPercentage.toFixed(0)}%`;
    statusEl.className = "status-details inactive-connection";
    ringStatusBox.querySelector("h3").innerHTML = "⚠️ RING TOPOLOGY BROKEN";
    ringStatusBox.style.borderColor = "var(--danger)";
    ringStatusBox.style.boxShadow = "0 0 10px rgba(255, 51, 102, 0.3)";
    return;
  }

  const tokenStatus = tokenActive && tokenInterval ? "🟢 ACTIVE" : "🔴 INACTIVE";
  statusEl.innerHTML = `NODES: ${health.activeNodes}/${health.totalNodes} | TOKEN: ${tokenStatus} | HEALTH: ${health.healthPercentage.toFixed(0)}%`;
  statusEl.className = "status-details active-connection";
  ringStatusBox.querySelector("h3").innerHTML = "✅ RING TOPOLOGY OPERATIONAL";
  ringStatusBox.style.borderColor = "var(--success)";
  ringStatusBox.style.boxShadow = "0 0 10px rgba(0, 255, 65, 0.3)";
}

/**
 * Initializes the functionality for collapsible sections in the UI.
 */
function initCollapsibleSections() {
  const sectionHeaders = document.querySelectorAll('.section-header');
  sectionHeaders.forEach(header => {
    header.addEventListener('click', function() {
      const section = this.parentElement;
      const content = section.querySelector('.section-content');
      const toggleIcon = this.querySelector('.toggle-icon');
      
      if (this.classList.contains('expanded')) {
        this.classList.remove('expanded');
        content.style.display = 'none';
        toggleIcon.textContent = '▼';
      } else {
        this.classList.add('expanded');
        content.style.display = 'block';
        toggleIcon.textContent = '▲';
      }
    });
  });
}

/**
 * Initializes the control event listeners for configuration sliders.
 */
function initConfigControls() {
  const latencySlider = document.getElementById('latencySlider');
  const latencyValue = document.getElementById('latencyValue');
  const packetSizeSlider = document.getElementById('packetSizeSlider');
  const packetSizeValue = document.getElementById('packetSizeValue');
  const enableCollisionsCheckbox = document.getElementById('enableCollisions');
  
  latencySlider.addEventListener('input', function() {
    currentLatency = parseInt(this.value);
    latencyValue.textContent = `${currentLatency}ms`;
    addLogEntry(`Network latency adjusted to ${currentLatency}ms`, "info");
  });
  
  packetSizeSlider.addEventListener('input', function() {
    currentPacketSize = parseInt(this.value);
    packetSizeValue.textContent = `${currentPacketSize} bytes`;
    addLogEntry(`Packet size adjusted to ${currentPacketSize} bytes`, "info");
  });
  
  enableCollisionsCheckbox.addEventListener('change', function() {
    enableCollisions = this.checked;
    const status = enableCollisions ? "enabled" : "disabled";
    addLogEntry(`Collision detection ${status}`, "info");
  });
}

/**
 * Updates the display of load test metrics.
 */
function updateLoadTestMetrics() {
  document.getElementById('packetsSent').textContent = loadTestMetrics.packetsSent;
  document.getElementById('packetsDelivered').textContent = loadTestMetrics.packetsDelivered;
  
  const successRate = loadTestMetrics.packetsSent > 0 ? 
    (loadTestMetrics.packetsDelivered / loadTestMetrics.packetsSent * 100).toFixed(1) : 0;
  document.getElementById('successRate').textContent = `${successRate}%`;
  
  const avgDeliveryTime = loadTestMetrics.deliveryTimes.length > 0 ?
    (loadTestMetrics.deliveryTimes.reduce((a, b) => a + b, 0) / loadTestMetrics.deliveryTimes.length).toFixed(0) : 0;
  document.getElementById('avgDeliveryTime').textContent = `${avgDeliveryTime}ms`;
  
  document.getElementById('collisionCount').textContent = collisionCount;
}

/**
 * Runs a demonstration sequence showcasing the ring topology features.
 */
function runDemoSequence() {
  let step = 0;
  const steps = [
    () => {
      addLogEntry("🎬 Starting Ring Topology Demo...", "info");
      resetAll();
    },
    () => {
      addLogEntry("📖 Step 1: Observing healthy ring with token circulation", "info");
    },
    () => {
      addLogEntry("📖 Step 2: Sending unicast packet PC 1 → PC 4", "info");
      sendRingPacket('node1', 'node4');
    },
    () => {
      addLogEntry("📖 Step 3: Broadcasting from PC 2 to all nodes", "info");
      broadcastRingPacket('node2');
    },
    () => {
      addLogEntry("📖 Step 4: Simulating node failure - disabling PC 3", "info");
      toggleNode('node3');
    },
    () => {
      addLogEntry("📖 Step 5: Attempting packet transmission with broken ring", "info");
      sendRingPacket('node1', 'node5');
    },
    () => {
      addLogEntry("📖 Step 6: Restoring network - enabling PC 3", "info");
      toggleNode('node3');
    },
    () => {
      addLogEntry("📖 Step 7: Confirming ring restoration", "info");
      sendRingPacket('node6', 'node2');
    },
    () => {
      addLogEntry("✅ Demo completed! Ring topology demonstration finished.", "info");
    }
  ];

  function runNextStep() {
    if (step < steps.length) {
      steps[step]();
      step++;
      if (step < steps.length) {
        setTimeout(runNextStep, 3000);
      }
    }
  }

  runNextStep();
}

/**
 * Sends a packet in the ring topology
 * @param {string} source - Source node ID
 * @param {string} target - Target node ID
 */
function sendRingPacket(source, target) {
  if (isAnimatingPacket) {
    addLogEntry("Cannot send packet: Animation in progress", "error");
    return;
  }

  if (!canTransmit(source, target)) {
    return;
  }

  const packetId = `unicast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  
  const packetData = {
    id: packetId,
    source: source,
    target: target,
    size: currentPacketSize,
    creationTime: Date.now()
  };

  if (packetQueue.length === 0) {
    packetQueue.push(packetData);
    processPacketQueue();
  } else {
    packetQueue.push(packetData);
    addLogEntry(`Packet queued: ${source.replace("node", "PC ")} → ${target.replace("node", "PC ")} (queue: ${packetQueue.length})`, "info");
  }
}

/**
 * Clear all logs
 */
function clearLogs() {
  packetLogEntries = [];
  const logContainer = document.getElementById("packetLog");
  if (logContainer) {
    logContainer.innerHTML = "";
  }
  addLogEntry("Log cleared", "info");
}

/**
 * Export network diagnostics
 */
function exportDiagnostics() {
  const health = checkNetworkHealth();
  const diagnostics = {
    timestamp: new Date().toISOString(),
    networkHealth: health,
    ringMetrics: ringMetrics,
    loadTestMetrics: loadTestMetrics,
    nodeStatus: nodeStatus,
    trafficData: trafficData,
    configuration: {
      nodeCount: nodeCount,
      currentLatency: currentLatency,
      currentPacketSize: currentPacketSize,
      enableCollisions: enableCollisions
    }
  };
  
  const dataStr = JSON.stringify(diagnostics, null, 2);
  const dataBlob = new Blob([dataStr], {type: 'application/json'});
  const url = URL.createObjectURL(dataBlob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `ring-topology-diagnostics-${Date.now()}.json`;
  link.click();
  
  URL.revokeObjectURL(url);
  addLogEntry("Network diagnostics exported", "info");
}

/**
 * Show network statistics in a popup
 */
function showNetworkStats() {
  const health = checkNetworkHealth();
  const totalPackets = Object.values(trafficData).reduce((sum, node) => 
    sum + node.packetsSent + node.packetsReceived, 0);
  
  const statsMessage = `
    <strong>Ring Network Statistics</strong><br>
    Active Nodes: ${health.activeNodes}/${health.totalNodes}<br>
    Ring Intact: ${health.ringIntact ? 'Yes' : 'No'}<br>
    Token Active: ${tokenActive && tokenInterval ? 'Yes' : 'No'}<br>
    Total Packets: ${totalPackets}<br>
    Collisions: ${collisionCount}<br>
    Token Passes: ${ringMetrics.tokenPasses}<br>
    Ring Breaks: ${ringMetrics.ringBreaks}
  `;
  
  addLogEntry(statsMessage, "info");
}

/**
 * Check the health of the ring network
 * @returns {boolean} - True if ring is healthy, false if broken
 */
function checkRingHealth() {
  const health = checkNetworkHealth();
  
  // Check if ring is intact and nodes are properly connected
  if (!health.ringIntact) {
    addLogEntry("🔴 Ring health check: BROKEN - Ring topology is not intact", "error");
    return false;
  }
  
  // Check if sufficient nodes are active
  const healthPercentage = health.healthPercentage;
  if (healthPercentage < 50) {
    addLogEntry(`🟡 Ring health check: DEGRADED - Only ${healthPercentage.toFixed(0)}% of nodes active`, "warning");
    return false;
  }
  
  // Check token circulation if enabled
  if (tokenActive && !tokenCirculating) {
    addLogEntry("🟡 Ring health check: WARNING - Token system not circulating", "warning");
    return false;
  }
  
  addLogEntry(`🟢 Ring health check: HEALTHY - ${health.activeNodes}/${health.totalNodes} nodes active`, "success");
  return true;
}

/**
 * Attempt to heal the ring network by reconnecting broken segments
 * @returns {boolean} - True if healing was successful, false otherwise
 */
function healRing() {
  const health = checkNetworkHealth();
  
  if (health.ringIntact) {
    addLogEntry("💚 Ring healing: No healing needed - ring is already intact", "info");
    return true;
  }
  
  // Find inactive nodes and try to reactivate them
  const inactiveNodes = Object.keys(nodeStatus).filter(nodeId => !nodeStatus[nodeId]);
  
  if (inactiveNodes.length === 0) {
    addLogEntry("🔴 Ring healing: FAILED - All nodes are active but ring is still broken", "error");
    return false;
  }
  
  // Try to reactivate the first inactive node to restore ring
  const nodeToHeal = inactiveNodes[0];
  
  addLogEntry(`🔧 Ring healing: Attempting to restore ${nodeToHeal.replace("node", "PC ")}...`, "info");
    // Reactivate the node
  nodeStatus[nodeToHeal] = true;
  updateVisuals(); // Use the existing updateVisuals function instead of the undefined updateNodeVisual
  updateNodeSelectors();
  updateStatusText();
  
  // Check if ring is now intact
  setTimeout(() => {
    const newHealth = checkNetworkHealth();
    if (newHealth.ringIntact) {
      addLogEntry(`✅ Ring healing: SUCCESS - ${nodeToHeal.replace("node", "PC ")} restored, ring is now intact`, "success");
      
      // Restart token circulation if it was active
      if (tokenActive && !tokenCirculating) {
        startTokenCirculation();
        addLogEntry("🔄 Token circulation restarted after ring healing", "info");
      }
      
      ringMetrics.ringHeals++;
      return true;
    } else {
      addLogEntry("🔴 Ring healing: PARTIAL - Node restored but ring still broken", "warning");
      return false;
    }
  }, 500);
  
  return true;
}

/**
 * Analyze the ring network and provide comprehensive diagnostics
 */
function analyzeRingNetwork() {
  addLogEntry("🔍 Starting comprehensive ring network analysis...", "info");
  
  const health = checkNetworkHealth();
  const analysis = {
    timestamp: new Date().toISOString(),
    topologyStatus: health.ringIntact ? "INTACT" : "BROKEN",
    nodeStatus: health,
    performance: {
      totalPacketsSent: Object.values(trafficData).reduce((sum, node) => sum + node.packetsSent, 0),
      totalPacketsReceived: Object.values(trafficData).reduce((sum, node) => sum + node.packetsReceived, 0),
      collisions: collisionCount,
      tokenPasses: ringMetrics.tokenPasses,
      ringBreaks: ringMetrics.ringBreaks,
      ringHeals: ringMetrics.ringHeals || 0
    },
    configuration: {
      nodeCount: nodeCount,
      latency: currentLatency,
      packetSize: currentPacketSize,
      collisionDetection: enableCollisions,
      tokenActive: tokenActive
    }
  };
  
  // Log detailed analysis
  addLogEntry(`📊 Network Topology: ${analysis.topologyStatus}`, 
              analysis.topologyStatus === "INTACT" ? "success" : "error");
  
  addLogEntry(`📈 Performance Metrics:
    • Packets Sent: ${analysis.performance.totalPacketsSent}
    • Packets Received: ${analysis.performance.totalPacketsReceived}
    • Collisions: ${analysis.performance.collisions}
    • Token Passes: ${analysis.performance.tokenPasses}`, "info");
  
  addLogEntry(`🔧 Configuration:
    • Nodes: ${analysis.configuration.nodeCount}
    • Latency: ${analysis.configuration.latency}ms
    • Packet Size: ${analysis.configuration.packetSize} bytes
    • Token System: ${analysis.configuration.tokenActive ? "ACTIVE" : "INACTIVE"}`, "info");
  
  // Check for potential issues
  const successRate = analysis.performance.totalPacketsSent > 0 ? 
    (analysis.performance.totalPacketsReceived / analysis.performance.totalPacketsSent * 100) : 100;
  
  if (successRate < 90) {
    addLogEntry(`⚠️ Network Warning: Low success rate (${successRate.toFixed(1)}%)`, "warning");
  }
  
  if (analysis.performance.collisions > 10) {
    addLogEntry(`⚠️ Network Warning: High collision count (${analysis.performance.collisions})`, "warning");
  }
  
  if (analysis.performance.ringBreaks > 3) {
    addLogEntry(`⚠️ Reliability Warning: Multiple ring breaks detected (${analysis.performance.ringBreaks})`, "warning");
  }
  
  // Provide recommendations
  if (!analysis.topologyStatus === "INTACT") {
    addLogEntry("💡 Recommendation: Use 'Ring Diagnostics' to check and heal the network", "info");
  }
  
  if (analysis.performance.collisions > 5) {
    addLogEntry("💡 Recommendation: Consider increasing network latency to reduce collisions", "info");
  }
  
  addLogEntry("✅ Network analysis complete", "success");
  
  // Store analysis for export
  window.lastNetworkAnalysis = analysis;
  
  return analysis;
}

/**
 * Toggle auto simulation mode on/off
 */
function toggleAutoSimulation() {
  if (autoSimulationRunning) {
    // Stop auto simulation
    if (autoSimulationInterval) {
      clearInterval(autoSimulationInterval);
      autoSimulationInterval = null;
    }
    autoSimulationRunning = false;
    
    document.getElementById("autoSimulate").textContent = "Auto Simulate";
    document.getElementById("autoSimulate").classList.remove("danger");
    
    addLogEntry("⏹️ Auto simulation stopped", "info");
  } else {
    // Start auto simulation
    if (isAnimatingPacket) {
      addLogEntry("Cannot start auto simulation: Animation in progress", "error");
      return;
    }
    
    autoSimulationRunning = true;
    document.getElementById("autoSimulate").textContent = "Stop Auto Sim";
    document.getElementById("autoSimulate").classList.add("danger");
    
    addLogEntry("🔄 Auto simulation started - sending packets every 3 seconds", "info");
    
    // Start interval for auto packet sending
    autoSimulationInterval = setInterval(() => {
      if (!isAnimatingPacket && autoSimulationRunning) {
        const activeNodes = Object.keys(nodeStatus).filter(nodeId => nodeStatus[nodeId]);
        
        if (activeNodes.length >= 2) {
          const sourceNode = activeNodes[Math.floor(Math.random() * activeNodes.length)];
          const remainingNodes = activeNodes.filter(node => node !== sourceNode);
          const targetNode = remainingNodes[Math.floor(Math.random() * remainingNodes.length)];
          
          // Randomly choose between unicast and broadcast
          if (Math.random() > 0.3) {
            sendRingPacket(sourceNode, targetNode);
          } else {
            broadcastRingPacket(sourceNode);
          }
        } else {
          addLogEntry("Auto simulation paused: Insufficient active nodes", "warning");
        }
      }
    }, 3000);
  }
}

/**
 * Updates the packet status display in the status box
 * @param {string} message - The status message to display
 * @param {string} type - The type of status (default, success, warning, error)
 */
function updatePacketStatusText(message, type = "default") {
  const packetStatusEl = document.getElementById("packetStatus");
  const packetStatusBox = document.getElementById("packetStatusBox");
  
  packetStatusEl.innerHTML = message;
  
  // Update styling based on type
  packetStatusBox.style.borderColor = "var(--border-primary)";
  packetStatusBox.style.boxShadow = "0 0 10px rgba(0, 212, 255, 0.3)";
  
  if (type === "success") {
    packetStatusBox.style.borderColor = "var(--success)";
    packetStatusBox.style.boxShadow = "0 0 10px rgba(0, 255, 65, 0.3)";
  } else if (type === "warning") {
    packetStatusBox.style.borderColor = "var(--warning)";
    packetStatusBox.style.boxShadow = "0 0 10px rgba(255, 170, 0, 0.3)";
  } else if (type === "error") {
    packetStatusBox.style.borderColor = "var(--danger)";
    packetStatusBox.style.boxShadow = "0 0 10px rgba(255, 51, 102, 0.3)";
  }
}
