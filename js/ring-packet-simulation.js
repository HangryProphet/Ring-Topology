/**
 * Creates a visual packet DOM element for ring topology
 * @param {number} [packetSize=64] - The size of the packet in bytes.
 * @returns {HTMLElement} The created packet element.
 */
function createPacketElement(packetSize = 64) {
  const packet = document.createElement('div');
  packet.className = 'packet';
  
  // Adjust visual size based on packet data size
  const sizeMultiplier = 0.8 + (packetSize / 1500) * 0.6; // Range: 0.8x to 1.4x
  const baseSize = 12; // Base visual size in pixels
  const visualSize = Math.round(baseSize * sizeMultiplier);
  
  packet.style.width = `${visualSize}px`;
  packet.style.height = `${visualSize}px`;
  
  const networkDiv = document.querySelector('#network');
  if (networkDiv) {
    networkDiv.appendChild(packet);
  }
  return packet;
}

/**
 * Creates a visual packet trail DOM element.
 * @param {number} [packetSize=64] - The size of the packet in bytes.
 * @returns {HTMLElement} The created trail element.
 */
function createTrailElement(packetSize = 64) {
  const trail = document.createElement('div');
  trail.className = 'packet-trail';
  
  const sizeMultiplier = 0.8 + (packetSize / 1500) * 0.6;
  const baseSize = 6;
  const visualSize = Math.round(baseSize * sizeMultiplier);

  trail.style.width = `${visualSize}px`;
  trail.style.height = `${visualSize}px`;
  
  const networkDiv = document.querySelector('#network');
  if (networkDiv) {
    networkDiv.appendChild(trail);
  }
  return trail;
}

/**
 * Removes all visual packet and trail elements from the DOM.
 */
function cleanupPacketElements() {
  packetElements.forEach(element => {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });
  packetElements = [];
}

/**
 * Creates a pulse effect at a specified node's position.
 * @param {string} nodeId - The ID of the node to apply the pulse effect to.
 */
function pulseEffect(nodeId) {
  const positions = network.getPositions([nodeId]);
  if (!positions || !positions[nodeId]) {
    console.error("Node position not found for pulse effect:", nodeId);
    return;
  }
  
  const nodePosition = positions[nodeId];
  const networkDiv = document.getElementById('network');
  if (!networkDiv) return;
  
  const rect = networkDiv.getBoundingClientRect();
  const centerX = rect.width / 2;
  const centerY = rect.height / 2;
  const x = centerX + nodePosition.x;
  const y = centerY + nodePosition.y;

  const pulse = document.createElement('div');
  pulse.className = 'packet pulse-effect';
  pulse.style.left = `${x}px`;
  pulse.style.top = `${y}px`;
  networkDiv.appendChild(pulse);
  packetElements.push(pulse);

  setTimeout(() => {
    if (pulse && pulse.parentNode) pulse.parentNode.removeChild(pulse);
    const index = packetElements.indexOf(pulse);
    if (index !== -1) packetElements.splice(index, 1);
  }, 600);
}

/**
 * Animates a packet along a path between two points in the ring
 * @param {number} x1 - Starting X coordinate.
 * @param {number} y1 - Starting Y coordinate.
 * @param {number} x2 - Ending X coordinate.
 * @param {number} y2 - Ending Y coordinate.
 * @param {string} packetId - The unique ID of the packet being animated.
 * @param {number} packetSize - The size of the packet in bytes.
 * @param {number} duration - The calculated duration for the animation segment.
 * @param {function} onComplete - Callback function to execute upon animation completion.
 */
function animatePacketAlongRingPath(x1, y1, x2, y2, packetId, packetSize, duration, onComplete) {
  const networkDiv = document.getElementById('network');
  if (!networkDiv) {
    console.error("Network div not found for animation.");
    if (onComplete) onComplete();
    return;
  }
  
  const packet = createPacketElement(packetSize);
  packetElements.push(packet);

  const startX = (networkDiv.clientWidth / 2) + x1;
  const startY = (networkDiv.clientHeight / 2) + y1;
  const endX = (networkDiv.clientWidth / 2) + x2;
  const endY = (networkDiv.clientHeight / 2) + y2;
  
  const startTime = performance.now();
  const trailInterval = Math.max(60, 140 - packetSize / 25); 
  let lastTrailTime = 0;
  
  function animate(currentTime) {
    if (!packet.parentNode) {
      if (onComplete) onComplete();
      return;
    }
    
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Smooth easing for ring movement
    const easedProgress = progress < 0.5 ? 
      2 * progress * progress : 
      1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    const currentX = startX + (endX - startX) * easedProgress;
    const currentY = startY + (endY - startY) * easedProgress;
    
    packet.style.left = `${currentX}px`;
    packet.style.top = `${currentY}px`;
    
    // Update packet position for collision detection
    const packetIndex = activePackets.findIndex(p => p.id === packetId);
    if (packetIndex !== -1) {
      activePackets[packetIndex].currentPosition = { x: currentX, y: currentY };
    }
    
    // Check for collisions in ring
    if (enableCollisions) {
      const hasCollision = checkRingCollisions(packetId, { x: currentX, y: currentY });
      if (hasCollision) {
        // Handle collision
        if (packet.parentNode) packet.parentNode.removeChild(packet);
        const visualPacketIndex = packetElements.indexOf(packet);
        if (visualPacketIndex !== -1) packetElements.splice(visualPacketIndex, 1);
        
        if (packetIndex !== -1) activePackets.splice(packetIndex, 1);
        isAnimatingPacket = false;
        collisionCount++;
        addLogEntry(`💥 Packet collision detected! Total collisions: ${collisionCount}`, "error");
        
        if (packetQueue.length > 0) setTimeout(processPacketQueue, 100);
        return;
      }
    }
    
    // Create trail effects
    if (currentTime - lastTrailTime > trailInterval && progress > 0.1 && progress < 0.9) {
      lastTrailTime = currentTime;
      const trail = createTrailElement(packetSize);
      trail.style.left = `${currentX}px`;
      trail.style.top = `${currentY}px`;
      packetElements.push(trail);
      
      setTimeout(() => {
        if (trail.parentNode) {
          trail.style.opacity = '0';
          setTimeout(() => {
            if (trail.parentNode) trail.parentNode.removeChild(trail);
            const trailIdx = packetElements.indexOf(trail);
            if (trailIdx !== -1) packetElements.splice(trailIdx, 1);
          }, 400);
        }
      }, 250);
    }
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      setTimeout(() => {
        if (packet.parentNode) packet.parentNode.removeChild(packet);
        const visualPacketIndex = packetElements.indexOf(packet);
        if (visualPacketIndex !== -1) packetElements.splice(visualPacketIndex, 1);
        if (onComplete) onComplete();
      }, 100);
    }
  }
  requestAnimationFrame(animate);
}

/**
 * Animates a packet through the ring from source to target
 * @param {string} source - Source node ID.
 * @param {string} target - Target node ID.
 * @param {string} packetId - Unique ID for the packet.
 * @param {number} packetSize - Size of the packet in bytes.
 */
function animateRingPacket(source, target, packetId, packetSize) {
  if (!canTransmit(source, target)) {
    isAnimatingPacket = false;
    const packetIndex = activePackets.findIndex(p => p.id === packetId);
    if (packetIndex !== -1) activePackets.splice(packetIndex, 1);
    if (packetQueue.length > 0) setTimeout(processPacketQueue, 100);
    return;
  }  const sourceIndex = getNodeIndexFromId(source);
  const targetIndex = getNodeIndexFromId(target);
  
  // Get the best available path (shortest or alternative)
  const pathInfo = getBestAvailablePath(sourceIndex, targetIndex);
  
  if (!pathInfo.path) {
    addLogEntry(`No viable path from ${source.replace('node', 'PC ')} to ${target.replace('node', 'PC ')}`, "error");
    isAnimatingPacket = false;
    const packetIndex = activePackets.findIndex(p => p.id === packetId);
    if (packetIndex !== -1) activePackets.splice(packetIndex, 1);
    if (packetQueue.length > 0) setTimeout(processPacketQueue, 100);
    return;
  }
  
  const path = pathInfo.path;
  const usingAlternativePath = pathInfo.isAlternative;
  
  if (usingAlternativePath) {
    addLogEntry(`🔄 Using alternative route: ${path.length - 1} hops (primary path blocked)`, "info");
  }
  
  if (path.length < 2) {
    addLogEntry("Invalid path calculated", "error");
    isAnimatingPacket = false;
    return;
  }

  const sizeSpeedFactor = 1 + ((packetSize - 64) / 1436);
  const adjustedSpeed = PACKET_SPEED * sizeSpeedFactor + currentLatency;
  
  let currentStep = 0;
  
  function animateNextStep() {    if (currentStep >= path.length - 1) {
      // Animation complete
      pulseEffect(target);
      updatePacketStatusText(`PACKET DELIVERED: ${source.replace("node", "PC ")} → ${target.replace("node", "PC ")}`, "success");
      addLogEntry(`📦 Packet delivered to ${target.replace("node", "PC ")} (${ipConfigurations[target]})`, "target");
      
      // Update traffic statistics
      if (trafficData[source]) {
        trafficData[source].packetsSent++;
        trafficData[source].lastUpdate = Date.now();
      }
      if (trafficData[target]) {
        trafficData[target].packetsReceived++;
        trafficData[target].lastUpdate = Date.now();
      }
      
      // Update load test metrics
      const pData = activePackets.find(p => p.id === packetId);
      if (pData && loadTestMetrics.startTime > 0) {
        const deliveryTime = Date.now() - pData.creationTime;
        loadTestMetrics.deliveryTimes.push(deliveryTime);
        loadTestMetrics.packetsDelivered++;
        updateLoadTestMetrics();
      }
        // Clean up
      const packetIndex = activePackets.findIndex(p => p.id === packetId);
      if (packetIndex !== -1) activePackets.splice(packetIndex, 1);
      
      isAnimatingPacket = false;
      
      // Check if we need to process more packets
      if (packetQueue.length > 0) {
        setTimeout(processPacketQueue, 200);
      } else if (loadTestActive) {
        // Load test completed when queue is empty
        loadTestActive = false;
        document.getElementById("runLoadTest").disabled = false;
        document.getElementById("stopLoadTest").disabled = true;
        addLogEntry("✅ Load test completed successfully!", "success");
      }
      return;
    }
    
    const fromNodeIndex = path[currentStep];
    const toNodeIndex = path[currentStep + 1];
    const fromNodeId = getNodeIdFromIndex(fromNodeIndex);
    const toNodeId = getNodeIdFromIndex(toNodeIndex);
    
    // Check if nodes are still active
    if (!nodeStatus[fromNodeId] || !nodeStatus[toNodeId]) {
      addLogEntry(`Path broken at ${fromNodeId} → ${toNodeId}`, "error");
      isAnimatingPacket = false;
      return;
    }
    
    const positions = network.getPositions([fromNodeId, toNodeId]);
    if (!positions[fromNodeId] || !positions[toNodeId]) {
      addLogEntry("Node positions not found", "error");
      isAnimatingPacket = false;
      return;
    }
    
    const fromPos = positions[fromNodeId];
    const toPos = positions[toNodeId];
    
    if (currentStep === 0) {
      addLogEntry(`📤 Packet ${packetId.substr(-4)} traveling: ${source.replace("node", "PC ")} → ${target.replace("node", "PC ")}`, "info");
    }
    
    addLogEntry(`🔄 Hop ${currentStep + 1}: ${fromNodeId.replace("node", "PC ")} → ${toNodeId.replace("node", "PC ")}`, "info");
    
    animatePacketAlongRingPath(
      fromPos.x, fromPos.y, 
      toPos.x, toPos.y, 
      packetId, packetSize, adjustedSpeed,
      () => {
        pulseEffect(toNodeId);
        currentStep++;
        setTimeout(animateNextStep, 50 + currentLatency);
      }
    );
  }
  
  animateNextStep();
}

/**
 * Broadcasts a packet to all nodes in the ring
 * @param {string} source - Source node ID
 */
function broadcastRingPacket(source) {
  if (!canTransmit(source)) {
    return;
  }
  
  const packetId = `broadcast-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  const broadcastTargets = [];
  
  // Get all active nodes except source
  for (let i = 1; i <= nodeCount; i++) {
    const nodeId = `node${i}`;
    if (nodeId !== source && nodeStatus[nodeId]) {
      broadcastTargets.push(nodeId);
    }
  }
  
  if (broadcastTargets.length === 0) {
    addLogEntry("No target nodes available for broadcast", "error");
    return;
  }
  
  addLogEntry(`📡 Broadcasting from ${source.replace("node", "PC ")} to ${broadcastTargets.length} nodes`, "info");
  
  // In ring topology, broadcast travels around the entire ring
  const sourceIndex = getNodeIndexFromId(source);
  let currentPosition = sourceIndex;
  let visitedNodes = [source];
  
  function broadcastNextHop() {
    if (visitedNodes.length > nodeCount) {
      addLogEntry("✅ Broadcast complete - packet traveled full ring", "info");
      isAnimatingPacket = false;
      if (packetQueue.length > 0) setTimeout(processPacketQueue, 200);
      return;
    }
    
    const nextPosition = getNextNodeInRing(currentPosition);
    const nextNodeId = getNodeIdFromIndex(nextPosition);
    
    if (visitedNodes.includes(nextNodeId)) {
      // Completed full ring
      addLogEntry("✅ Broadcast complete - full ring traversed", "info");
      isAnimatingPacket = false;
      if (packetQueue.length > 0) setTimeout(processPacketQueue, 200);
      return;
    }
    
    if (!nodeStatus[nextNodeId]) {
      addLogEntry(`Broadcast stopped at inactive node ${nextNodeId.replace("node", "PC ")}`, "error");
      isAnimatingPacket = false;
      return;
    }
    
    const currentNodeId = getNodeIdFromIndex(currentPosition);
    const positions = network.getPositions([currentNodeId, nextNodeId]);
    
    if (!positions[currentNodeId] || !positions[nextNodeId]) {
      addLogEntry("Position error in broadcast", "error");
      isAnimatingPacket = false;
      return;
    }
    
    const fromPos = positions[currentNodeId];
    const toPos = positions[nextNodeId];
    
    addLogEntry(`📡 Broadcast hop: ${currentNodeId.replace("node", "PC ")} → ${nextNodeId.replace("node", "PC ")}`, "info");
    
    animatePacketAlongRingPath(
      fromPos.x, fromPos.y,
      toPos.x, toPos.y,
      packetId, currentPacketSize, PACKET_SPEED,
      () => {
        pulseEffect(nextNodeId);
        visitedNodes.push(nextNodeId);
        currentPosition = nextPosition;
        
        // Update traffic stats
        if (trafficData[nextNodeId]) {
          trafficData[nextNodeId].packetsReceived++;
          trafficData[nextNodeId].lastUpdate = Date.now();
        }
        
        setTimeout(broadcastNextHop, 100 + currentLatency);
      }
    );
  }
  
  broadcastNextHop();
}

/**
 * Check for collisions in ring topology
 * @param {string} packetId - Current packet ID
 * @param {Object} position - Current packet position
 * @returns {boolean} - Whether collision occurred
 */
function checkRingCollisions(packetId, position) {
  if (!enableCollisions) return false;
  
  const collisionRadius = 30; // Collision detection radius
  
  for (const otherPacket of activePackets) {
    if (otherPacket.id === packetId) continue;
    if (!otherPacket.currentPosition) continue;
    
    const distance = Math.sqrt(
      Math.pow(position.x - otherPacket.currentPosition.x, 2) +
      Math.pow(position.y - otherPacket.currentPosition.y, 2)
    );
    
    if (distance < collisionRadius) {
      addLogEntry(`💥 Collision between packets ${packetId.substr(-4)} and ${otherPacket.id.substr(-4)}`, "error");
      return true;
    }
  }
  
  return false;
}

/**
 * Process the packet queue for ring topology
 */
function processPacketQueue() {
  if (isAnimatingPacket || packetQueue.length === 0) {
    return;
  }
  
  const packetData = packetQueue.shift();
  isAnimatingPacket = true;
  
  // Add to active packets for collision detection
  activePackets.push({
    id: packetData.id,
    source: packetData.source,
    target: packetData.target,
    size: packetData.size,
    creationTime: packetData.creationTime,
    currentPosition: null,
    currentSegment: 0
  });
  
  if (packetData.target) {
    // Unicast transmission
    animateRingPacket(packetData.source, packetData.target, packetData.id, packetData.size);
  } else {
    // Broadcast transmission
    broadcastRingPacket(packetData.source);
  }
}
