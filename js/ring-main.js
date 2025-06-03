/**
 * Ring Topology Network Simulator - Main Initialization
 * Coordinates all components and sets up the complete ring topology simulator
 */

// Initialize the ring topology simulator when page loads
document.addEventListener("DOMContentLoaded", function() {
  console.log("🔵 Initializing Ring Topology Simulator...");
  
  try {
    // Initialize network visualization
    createNetwork();
    addLogEntry("🔵 Ring network topology created successfully", "info");
    
    // Initialize UI event handlers
    setupRingEventHandlers();
    addLogEntry("🔵 Ring UI handlers initialized", "info");
    
    // Start initial visual updates
    updateVisuals();
    
    // Initialize traffic monitoring
    initializeTrafficMonitoring();
    
    // Setup token circulation (initially stopped)
    if (typeof createTokenElement === 'function') {
      createTokenElement();
      addLogEntry("🔵 Token system initialized", "info");
    }
    
    // Update node selectors
    updateNodeSelectors();
    
    // Display welcome message
    addLogEntry("🟢 Ring Topology Simulator ready! Click any node to toggle its status.", "success");
    addLogEntry("💡 Try the demo sequence to see all features in action.", "info");
    
    console.log("✅ Ring Topology Simulator initialized successfully");
    
  } catch (error) {
    console.error("❌ Error initializing Ring Topology Simulator:", error);
    addLogEntry(`❌ Initialization error: ${error.message}`, "error");
  }
});

/**
 * Setup all event handlers for the ring topology UI
 */
function setupRingEventHandlers() {
  // Network Control Listeners
  document.getElementById("resetNetwork").addEventListener("click", () => {
    resetAll();
    addLogEntry("🔄 Network reset to default state", "info");
  });
  
  document.getElementById("addNode").addEventListener("click", addNode);
  document.getElementById("removeNode").addEventListener("click", removeNode);

  // Packet Control Listeners  
  document.getElementById("sendPacket").addEventListener("click", () => {
    const source = document.getElementById("sourceNode").value;
    const target = document.getElementById("targetNode").value;
    const packetMode = document.querySelector('input[name="packetMode"]:checked').value;

    if (isAnimatingPacket) {
      addLogEntry("Cannot send: Animation in progress.", "error");
      return;
    }
    if (!source) {
      addLogEntry("Please select a source node.", "error");
      return;
    }
    if (packetMode === "unicast" && !target) {
      addLogEntry("Please select a target node for unicast.", "error");
      return;
    }
    if (source === target && packetMode === "unicast") {
      addLogEntry("Source and target cannot be the same.", "error");
      return;
    }

    if (packetMode === "unicast") {
      sendRingPacket(source, target);
    } else if (packetMode === "broadcast") {
      broadcastRingPacket(source);
    }
  });

  // Token Control Listeners
  document.getElementById("startToken").addEventListener("click", () => {
    if (tokenCirculating) {
      addLogEntry("Token is already circulating", "warning");
      return;
    }
    startTokenCirculation();
    addLogEntry("🔄 Token circulation started", "info");
  });

  document.getElementById("stopToken").addEventListener("click", () => {
    if (!tokenCirculating) {
      addLogEntry("Token is not circulating", "warning");
      return;
    }
    stopTokenCirculation();
    addLogEntry("⏹️ Token circulation stopped", "info");
  });

  // Demo and Simulation Listeners
  document.getElementById("startDemo").addEventListener("click", () => {
    if (isAnimatingPacket) {
      addLogEntry("Cannot start demo: Animation in progress.", "error");
      return;
    }
    runDemoSequence();
  });
  document.getElementById("autoSimulate").addEventListener("click", toggleAutoSimulation);
  document.getElementById("runLoadTest").addEventListener("click", () => {
    if (isAnimatingPacket) {
      addLogEntry("Cannot start load test: Animation in progress.", "error");
      return;
    }
    runLoadTest();
  });
  
  document.getElementById("stopLoadTest").addEventListener("click", () => {
    stopLoadTest();
  });

  // Network Analysis Listeners
  document.getElementById("analyzeNetwork").addEventListener("click", analyzeRingNetwork);
  document.getElementById("exportDiagnostics").addEventListener("click", exportDiagnostics);
  document.getElementById("showStats").addEventListener("click", showNetworkStats);

  // Ring Health Listeners
  document.getElementById("checkRingHealth").addEventListener("click", () => {
    const healthStatus = checkRingHealth();
    addLogEntry(`🔍 Ring health check: ${healthStatus ? "HEALTHY" : "BROKEN"}`, 
                healthStatus ? "success" : "error");
    
    if (!healthStatus) {
      addLogEntry("💡 Attempting ring healing...", "info");
      const healed = healRing();
      addLogEntry(`🔧 Ring healing: ${healed ? "SUCCESS" : "FAILED"}`, 
                  healed ? "success" : "error");
    }
  });

  // Configuration Listeners
  document.getElementById("enableCollisions").addEventListener("change", (e) => {
    enableCollisions = e.target.checked;
    addLogEntry(`Collision detection: ${enableCollisions ? "ENABLED" : "DISABLED"}`, "info");
  });

  document.getElementById("latencySlider").addEventListener("input", (e) => {
    currentLatency = parseInt(e.target.value);
    document.getElementById("latencyValue").textContent = currentLatency;
    addLogEntry(`Latency set to: ${currentLatency}ms`, "info");
  });

  document.getElementById("packetSizeSlider").addEventListener("input", (e) => {
    currentPacketSize = parseInt(e.target.value);
    document.getElementById("packetSizeValue").textContent = currentPacketSize;
    addLogEntry(`Packet size set to: ${currentPacketSize} bytes`, "info");
  });

  // Advanced Features Listeners
  document.getElementById("simulateFailure").addEventListener("click", () => {
    const activeNodes = Object.keys(nodeStatus).filter(nodeId => nodeStatus[nodeId]);
    if (activeNodes.length === 0) {
      addLogEntry("No active nodes to simulate failure", "error");
      return;
    }
    
    const randomNode = activeNodes[Math.floor(Math.random() * activeNodes.length)];
    toggleNode(randomNode);
    addLogEntry(`🔴 Simulated failure of ${randomNode.replace("node", "PC ")}`, "warning");
    
    // Check if ring is still functional
    setTimeout(() => {
      const healthStatus = checkRingHealth();
      addLogEntry(`Ring status after failure: ${healthStatus ? "STILL FUNCTIONAL" : "BROKEN"}`, 
                  healthStatus ? "warning" : "error");
    }, 500);
  });

  document.getElementById("clearLogs").addEventListener("click", clearLogs);

  // User Guide Listeners
  document.getElementById("showGuide").addEventListener("click", () => {
    document.getElementById("userGuide").style.display = "block";
  });

  document.getElementById("closeGuide").addEventListener("click", () => {
    document.getElementById("userGuide").style.display = "none";
  });

  // Close user guide when clicking outside
  document.getElementById("userGuide").addEventListener("click", (e) => {
    if (e.target.id === "userGuide") {
      document.getElementById("userGuide").style.display = "none";
    }
  });

  console.log("✅ Ring topology event handlers setup complete");
}

/**
 * Initialize traffic monitoring for ring nodes
 */
function initializeTrafficMonitoring() {
  // Initialize traffic data for all nodes
  for (let i = 1; i <= nodeCount; i++) {
    const nodeId = `node${i}`;
    if (!trafficData[nodeId]) {
      trafficData[nodeId] = {
        packetsSent: 0,
        packetsReceived: 0,
        lastUpdate: Date.now()
      };
    }
  }
  
  // Start periodic traffic updates
  setInterval(() => {
    updateTrafficVisualization();
  }, 2000);
  
  console.log("✅ Traffic monitoring initialized");
}

/**
 * Update traffic visualization on nodes
 */
function updateTrafficVisualization() {
  if (!network || !data) return;
  
  Object.keys(trafficData).forEach(nodeId => {
    if (nodeId.startsWith('node')) {
      const traffic = trafficData[nodeId];
      const totalTraffic = traffic.packetsSent + traffic.packetsReceived;
      
      // Update node title with traffic info
      const currentNode = data.nodes.get(nodeId);
      if (currentNode) {
        currentNode.title = `${currentNode.label}\nIP: ${ipConfigurations[nodeId]}\nTraffic: ${totalTraffic} packets\nSent: ${traffic.packetsSent} | Received: ${traffic.packetsReceived}`;
        data.nodes.update(currentNode);
      }
    }
  });
}

/**
 * Global error handler for the ring topology simulator
 */
window.addEventListener('error', function(e) {
  console.error('Ring Topology Simulator Error:', e.error);
  addLogEntry(`System Error: ${e.error.message}`, "error");
});

/**
 * Handle visibility change to pause/resume animations
 */
document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    // Page is hidden, pause intensive operations
    if (autoSimulateInterval) {
      console.log("⏸️ Pausing auto-simulation (page hidden)");
    }
  } else {
    // Page is visible again
    console.log("▶️ Resuming ring topology simulator");
  }
});

// Export functions for global access
window.RingTopologySimulator = {
  reset: resetAll,
  sendPacket: sendRingPacket,
  broadcast: broadcastRingPacket,
  startToken: startTokenCirculation,
  stopToken: stopTokenCirculation,
  checkHealth: checkRingHealth,
  healRing: healRing,
  runDemo: runDemoSequence,
  loadTest: runLoadTest
};

console.log("🔵 Ring Topology Simulator main.js loaded");
