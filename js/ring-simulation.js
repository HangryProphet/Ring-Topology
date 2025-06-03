/**
 * Initiates or stops the automatic simulation of packet transmissions in ring topology.
 */
function autoSimulate() {
  const button = document.getElementById("autoSimulate");
  if (autoSimulateInterval) {
    clearInterval(autoSimulateInterval);
    autoSimulateInterval = null;
    button.textContent = "Auto Simulate";
    addLogEntry("Auto simulation stopped", "info");
  } else {
    button.textContent = "Stop Auto Simulate";
    addLogEntry("Auto simulation started", "info");
    runOneRingSimulation(); // Run first simulation immediately
    autoSimulateInterval = setInterval(runOneRingSimulation, PACKET_SPEED * 2 + currentLatency * 1.5);
  }
}

/**
 * Runs a single step of the automatic simulation for ring topology.
 */
function runOneRingSimulation() {
  if (isAnimatingPacket) return;

  const activeNodes = [];
  for (let i = 1; i <= nodeCount; i++) {
    const nodeId = `node${i}`;
    if (nodeStatus[nodeId] && data.nodes.get(nodeId)) {
      activeNodes.push(nodeId);
    }
  }

  if (activeNodes.length < 2) {
    addLogEntry("Auto Sim: Need at least 2 active nodes.", "error");
    return;
  }

  if (!isRingIntact()) {
    addLogEntry("Auto Sim: Ring is broken - cannot simulate", "error");
    return;
  }

  const shouldBroadcast = Math.random() < 0.25; // 25% chance of broadcast
  const source = activeNodes[Math.floor(Math.random() * activeNodes.length)];

  if (shouldBroadcast) {
    broadcastRingPacket(source);
  } else {
    let target;
    do {
      target = activeNodes[Math.floor(Math.random() * activeNodes.length)];
    } while (source === target);
    sendRingPacket(source, target);
  }
}

/**
 * Runs a load test by sending a specified number of packets in ring topology.
 */
function runLoadTest() {
  if (isAnimatingPacket) {
    addLogEntry("Cannot start load test: Animation in progress.", "error");
    return;
  }
  
  if (loadTestActive) {
    addLogEntry("Load test already in progress. Stop the current test first.", "warning");
    return;
  }

  if (!isRingIntact()) {
    addLogEntry("Load Test: Ring topology must be intact to run load test.", "error");
    return;
  }

  const numPackets = parseInt(document.getElementById('loadTestPackets').value);
  const activeNodes = [];
  for (let i = 1; i <= nodeCount; i++) {
    const nodeId = `node${i}`;
    if (nodeStatus[nodeId] && data.nodes.get(nodeId)) {
      activeNodes.push(nodeId);
    }
  }

  if (activeNodes.length < 2) {
    addLogEntry("Load Test: Requires at least 2 active nodes.", "error");
    return;
  }

  // Reset metrics for the new test
  loadTestMetrics = {
    packetsSent: 0,
    packetsDelivered: 0,
    collisions: 0,
    deliveryTimes: [],
    startTime: Date.now()
  };
    collisionCount = 0; // Reset collision count
  document.getElementById('loadTestResults').style.display = 'block';
  document.getElementById("runLoadTest").disabled = true;
  document.getElementById("stopLoadTest").disabled = false;
  loadTestActive = true;
  updateLoadTestMetrics();

  addLogEntry(`🚀 Starting load test: ${numPackets} packets`, "info");

  for (let i = 0; i < numPackets; i++) {
    let source, target;
    do {
      source = activeNodes[Math.floor(Math.random() * activeNodes.length)];
      target = activeNodes[Math.floor(Math.random() * activeNodes.length)];
    } while (source === target);
    
    const packetData = {
      id: 'loadtest-' + Date.now() + '-' + i + Math.random().toString(36).substr(2, 5),
      source: source,
      target: target,
      size: currentPacketSize,
      creationTime: Date.now() + (i * (100 + currentLatency / 2))
    };
    
    packetQueue.push(packetData);
    loadTestMetrics.packetsSent++;
  }
  
  updateLoadTestMetrics();
  addLogEntry(`Load test started: ${numPackets} packets queued for ring transmission.`, "info");
  processPacketQueue();
}

/**
 * Stops a currently running load test
 */
function stopLoadTest() {
  if (!loadTestActive) {
    addLogEntry("No load test is currently running.", "warning");
    return;
  }
  
  // Clear the packet queue
  const packetCount = packetQueue.length;
  packetQueue = [];
  loadTestActive = false;
  
  // Update the UI
  document.getElementById("runLoadTest").disabled = false;
  document.getElementById("stopLoadTest").disabled = true;
  
  addLogEntry(`🛑 Load test stopped. ${packetCount} queued packets cancelled.`, "warning");
  
  // Final update to metrics
  loadTestMetrics.endTime = Date.now();
  updateLoadTestMetrics();
}

/**
 * Simulate collision manually for testing
 */
function simulateCollisionOnClick() {
  if (!enableCollisions) {
    addLogEntry("Enable collision detection first", "error");
    return;
  }

  if (isAnimatingPacket) {
    addLogEntry("Cannot simulate collision: Animation in progress", "error");
    return;
  }

  const activeNodes = [];
  for (let i = 1; i <= nodeCount; i++) {
    const nodeId = `node${i}`;
    if (nodeStatus[nodeId]) {
      activeNodes.push(nodeId);
    }
  }

  if (activeNodes.length < 4) {
    addLogEntry("Need at least 4 active nodes to simulate collision", "error");
    return;
  }

  // Send two packets that will likely collide
  const source1 = activeNodes[0];
  const target1 = activeNodes[Math.floor(activeNodes.length / 2)];
  const source2 = activeNodes[1];
  const target2 = activeNodes[Math.floor(activeNodes.length / 2) + 1];

  addLogEntry("🧪 Simulating packet collision scenario...", "info");
  
  // Queue two packets with small delay to increase collision probability
  const packet1 = {
    id: 'collision-test-1-' + Date.now(),
    source: source1,
    target: target1,
    size: currentPacketSize,
    creationTime: Date.now()
  };
  
  const packet2 = {
    id: 'collision-test-2-' + Date.now(),
    source: source2,
    target: target2,
    size: currentPacketSize,
    creationTime: Date.now() + 50
  };

  packetQueue.push(packet1);
  packetQueue.push(packet2);
  
  if (!isAnimatingPacket) {
    processPacketQueue();
  }
}

/**
 * Simulate ring healing scenario
 */
function simulateRingHealing() {
  addLogEntry("🔧 Starting ring healing simulation...", "info");
  
  // Disable a random node
  const activeNodes = Object.keys(nodeStatus).filter(nodeId => 
    nodeStatus[nodeId] && data.nodes.get(nodeId)
  );
  
  if (activeNodes.length <= 3) {
    addLogEntry("Need more active nodes for healing simulation", "error");
    return;
  }
  
  const nodeToDisable = activeNodes[Math.floor(Math.random() * activeNodes.length)];
  addLogEntry(`Disabling ${nodeToDisable.replace('node', 'PC ')} to break ring...`, "info");
  
  toggleNode(nodeToDisable);
  
  setTimeout(() => {
    addLogEntry("Attempting ring healing...", "info");
    const healingSuccess = attemptRingHealing();
    
    setTimeout(() => {
      addLogEntry(`Re-enabling ${nodeToDisable.replace('node', 'PC ')} to restore ring...`, "info");
      toggleNode(nodeToDisable);
      
      setTimeout(() => {
        addLogEntry("Ring healing simulation complete", "info");
      }, 1000);
    }, 3000);
  }, 2000);
}

/**
 * Performance benchmark for ring topology
 */
function runPerformanceBenchmark() {
  if (isAnimatingPacket) {
    addLogEntry("Cannot run benchmark: Animation in progress", "error");
    return;
  }
  
  if (!isRingIntact()) {
    addLogEntry("Cannot run benchmark: Ring must be intact", "error");
    return;
  }
  
  addLogEntry("🏃‍♂️ Starting performance benchmark...", "info");
  
  const benchmarkSizes = [64, 256, 512, 1024, 1500];
  const results = {};
  let currentSizeIndex = 0;
  
  function runBenchmarkForSize() {
    if (currentSizeIndex >= benchmarkSizes.length) {
      // Display results
      addLogEntry("📊 Benchmark Results:", "info");
      for (const [size, result] of Object.entries(results)) {
        addLogEntry(`${size} bytes: ${result.avgTime}ms avg, ${result.successRate}% success`, "info");
      }
      addLogEntry("Benchmark complete", "info");
      return;
    }
    
    const packetSize = benchmarkSizes[currentSizeIndex];
    const oldPacketSize = currentPacketSize;
    currentPacketSize = packetSize;
    
    addLogEntry(`Testing ${packetSize} byte packets...`, "info");
    
    // Reset metrics
    const startTime = Date.now();
    const testPackets = [];
    
    // Send 10 test packets
    for (let i = 0; i < 10; i++) {
      const source = `node${(i % nodeCount) + 1}`;
      const target = `node${((i + 2) % nodeCount) + 1}`;
      
      const packetData = {
        id: `benchmark-${packetSize}-${i}-${Date.now()}`,
        source: source,
        target: target,
        size: packetSize,
        creationTime: Date.now() + (i * 200)
      };
      
      testPackets.push(packetData);
      packetQueue.push(packetData);
    }
    
    processPacketQueue();
    
    // Check results after delay
    setTimeout(() => {
      const deliveredCount = testPackets.filter(p => 
        loadTestMetrics.deliveryTimes.some(time => time > 0)
      ).length;
      
      const avgTime = loadTestMetrics.deliveryTimes.length > 0 ?
        loadTestMetrics.deliveryTimes.reduce((a, b) => a + b, 0) / loadTestMetrics.deliveryTimes.length : 0;
      
      results[packetSize] = {
        avgTime: avgTime.toFixed(1),
        successRate: ((deliveredCount / testPackets.length) * 100).toFixed(1)
      };
      
      currentPacketSize = oldPacketSize;
      currentSizeIndex++;
      
      setTimeout(runBenchmarkForSize, 1000);
    }, 5000);
  }
  
  runBenchmarkForSize();
}

/**
 * Stress test the ring topology
 */
function runStressTest() {
  if (!isRingIntact()) {
    addLogEntry("Cannot run stress test: Ring must be intact", "error");
    return;
  }
  
  addLogEntry("⚡ Starting stress test - high packet volume", "info");
  
  // Temporarily increase simulation speed
  const originalSpeed = PACKET_SPEED;
  PACKET_SPEED = 300; // Faster packets
  
  // Generate many packets quickly
  for (let i = 0; i < 50; i++) {
    const source = `node${(i % nodeCount) + 1}`;
    const target = `node${((i + 3) % nodeCount) + 1}`;
    
    const packetData = {
      id: `stress-${i}-${Date.now()}`,
      source: source,
      target: target,
      size: 64 + (i % 5) * 128, // Variable packet sizes
      creationTime: Date.now() + (i * 50) // Rapid fire
    };
    
    packetQueue.push(packetData);
  }
  
  processPacketQueue();
  
  // Restore original speed after test
  setTimeout(() => {
    PACKET_SPEED = originalSpeed;
    addLogEntry("Stress test completed - speed restored", "info");
  }, 10000);
}
