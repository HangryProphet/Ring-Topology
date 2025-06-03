/**
 * Toggles the active/inactive state of a specified node.
 * @param {string} nodeId - The ID of the node to toggle.
 */
function toggleNode(nodeId) {
  nodeStatus[nodeId] = !nodeStatus[nodeId];
  const status = nodeStatus[nodeId] ? "active" : "inactive";
  addLogEntry(`${nodeId.replace("node", "PC ")} is now <span class="${status}-connection">${status.toUpperCase()}</span>`, "info");
  
  // Check if ring is still intact
  if (!isRingIntact()) {
    addLogEntry("⚠️ Ring topology is broken! Some connections are inactive.", "error");
    stopTokenCirculation();
  } else if (!tokenInterval && tokenActive) {
    addLogEntry("✅ Ring topology restored - resuming token circulation", "info");
    startTokenCirculation();
  }
  
  updateVisuals();
}

/**
 * Resets all nodes to their active state.
 */
function resetAll() {
  for (let i = 1; i <= nodeCount; i++) {
    const nodeId = `node${i}`;
    if (data.nodes.get(nodeId)) {
      nodeStatus[nodeId] = true;
    }
  }
  
  tokenActive = true;
  tokenPosition = 0;
  
  addLogEntry("All nodes have been reset to <span class=\"active-connection\">ACTIVE</span>", "info");
  addLogEntry("✅ Ring topology fully operational", "info");
  
  if (!tokenInterval) {
    startTokenCirculation();
  }
  
  updateVisuals();
}

/**
 * Generates an IP address for a new node based on its index.
 * @param {number} nodeIndex - The index of the new node.
 * @returns {string} The generated IP address.
 */
function generateIP(nodeIndex) {
  return `192.168.1.${9 + nodeIndex}`;
}

/**
 * Adds a new node to the ring network.
 */
function addNode() {
  if (isAnimatingPacket) {
    addLogEntry("Cannot add node while packet is in transit", "error");
    return;
  }
  
  if (nodeCount >= 12) {
    addLogEntry("Maximum ring size reached (12 nodes)", "error");
    return;
  }
  
  // Store token state before modification
  const wasTokenActive = tokenActive;
  const wasTokenCirculating = tokenCirculating;
  
  nodeCount++;
  const newNodeId = `node${nodeCount}`;
  
  nodeStatus[newNodeId] = true;
  trafficData[newNodeId] = {
    packetsSent: 0,
    packetsReceived: 0,
    lastUpdate: Date.now()
  };
  
  if (!ipConfigurations[newNodeId]) {
    ipConfigurations[newNodeId] = generateIP(nodeCount);
  }
  
  // Stop token circulation before rebuilding network
  if (tokenCirculating) {
    stopTokenCirculation();
  }
  
  createNetwork();
  addLogEntry(`Added new node: PC ${nodeCount} (${ipConfigurations[newNodeId]})`, "info");
  
  // Restore token circulation if it was active
  if (wasTokenActive && wasTokenCirculating) {
    setTimeout(() => {
      tokenActive = true;
      tokenCirculating = false; // Reset before starting
      startTokenCirculation();
      addLogEntry("🔄 Token circulation restored after adding node", "info");
    }, 1000);
  }
}

/**
 * Removes the last added node from the ring network.
 */
function removeNode() {
  if (nodeCount <= 3) {
    addLogEntry("Minimum ring size is 3 nodes", "error");
    return;
  }
  
  if (isAnimatingPacket) {
    addLogEntry("Cannot remove node while packet is in transit", "error");
    return;
  }
  
  // Store token state before modification
  const wasTokenActive = tokenActive;
  const wasTokenCirculating = tokenCirculating;
  
  const removedNodeId = `node${nodeCount}`;
  const removedNodeIP = ipConfigurations[removedNodeId] || `(IP not found for PC ${nodeCount})`;
  addLogEntry(`Removed node: PC ${nodeCount} (${removedNodeIP})`, "info");
  
  delete nodeStatus[removedNodeId];
  delete trafficData[removedNodeId];
  
  nodeCount--;
  
  // Stop token circulation before rebuilding network
  if (tokenCirculating) {
    stopTokenCirculation();
  }
  
  // Adjust token position if it was on the removed node
  if (tokenPosition >= nodeCount) {
    tokenPosition = 0;
  }
  
  createNetwork();
    // Restore token circulation if it was active
  if (wasTokenActive && wasTokenCirculating) {
    setTimeout(() => {
      tokenActive = true;
      tokenCirculating = false; // Reset before starting
      startTokenCirculation();
      addLogEntry("🔄 Token circulation restored after removing node", "info");
    }, 1000);
  }
}

/**
 * Checks if packet transmission is possible in the ring.
 * In a bidirectional ring topology, tries both directions if shortest path is blocked.
 * @param {string} source - Source node ID
 * @param {string} target - Target node ID (optional for broadcast)
 * @returns {boolean} - Whether transmission is possible
 */
function canTransmit(source, target = null) {
  if (!nodeStatus[source]) {
    addLogEntry(`Source node ${source.replace('node', 'PC ')} is inactive`, "error");
    return false;
  }
  
  if (target && !nodeStatus[target]) {
    addLogEntry(`Target node ${target.replace('node', 'PC ')} is inactive`, "error");
    return false;
  }
  
  // For ring topology, check if any path is available (bidirectional)
  if (target) {
    const sourceIndex = getNodeIndexFromId(source);
    const targetIndex = getNodeIndexFromId(target);
    
    // Try shortest path first
    const shortestPath = getShortestRingPath(sourceIndex, targetIndex);
    let shortestPathValid = true;
    
    for (const nodeIndex of shortestPath) {
      const nodeId = getNodeIdFromIndex(nodeIndex);
      if (!nodeStatus[nodeId]) {
        shortestPathValid = false;
        break;
      }
    }
    
    if (shortestPathValid) {
      return true; // Shortest path is available
    }
    
    // If shortest path is blocked, try alternative path (other direction)
    const alternativePath = getAlternativeRingPath(sourceIndex, targetIndex);
    let alternativePathValid = true;
    
    for (const nodeIndex of alternativePath) {
      const nodeId = getNodeIdFromIndex(nodeIndex);
      if (!nodeStatus[nodeId]) {
        alternativePathValid = false;
        break;
      }
    }
    
    if (alternativePathValid) {
      addLogEntry(`Primary path blocked, using alternative route: ${source.replace('node', 'PC ')} → ${target.replace('node', 'PC ')}`, "info");
      return true; // Alternative path is available
    }
    
    // Both paths are blocked
    addLogEntry(`All paths blocked: Cannot reach ${target.replace('node', 'PC ')} from ${source.replace('node', 'PC ')}`, "error");
    return false;
  } else {
    // For broadcast, check if ring has enough connectivity
    const activeNodes = Object.keys(nodeStatus).filter(nodeId => nodeStatus[nodeId]).length;
    if (activeNodes < 2) {
      addLogEntry("Broadcast blocked: Need at least 2 active nodes", "error");
      return false;
    }
    return true; // Allow broadcast if we have some connectivity
  }
}

/**
 * Finds alternative path in case of node failure (ring healing)
 * @param {string} source - Source node ID
 * @param {string} target - Target node ID
 * @returns {Array|null} - Array of node indices for alternative path or null if no path
 */
function findAlternativePath(source, target) {
  const sourceIndex = getNodeIndexFromId(source);
  const targetIndex = getNodeIndexFromId(target);
  
  // Try clockwise path
  let path = [];
  let current = sourceIndex;
  let found = false;
  
  for (let i = 0; i < nodeCount && !found; i++) {
    path.push(current);
    if (current === targetIndex) {
      found = true;
      break;
    }
    
    const nextNode = (current + 1) % nodeCount;
    const nextNodeId = getNodeIdFromIndex(nextNode);
    
    if (!nodeStatus[nextNodeId]) {
      break; // Path blocked
    }
    
    current = nextNode;
  }
  
  if (found) return path;
  
  // Try counter-clockwise path
  path = [];
  current = sourceIndex;
  found = false;
  
  for (let i = 0; i < nodeCount && !found; i++) {
    path.push(current);
    if (current === targetIndex) {
      found = true;
      break;
    }
    
    const nextNode = (current - 1 + nodeCount) % nodeCount;
    const nextNodeId = getNodeIdFromIndex(nextNode);
    
    if (!nodeStatus[nextNodeId]) {
      break; // Path blocked
    }
    
    current = nextNode;
  }
  
  return found ? path : null;
}

/**
 * Simulate token release (manual token control)
 */
function simulateToken() {
  if (!isRingIntact()) {
    addLogEntry("Cannot release token: Ring is broken", "error");
    return;
  }
  
  if (!tokenActive) {
    tokenActive = true;
    addLogEntry("Token circulation activated", "info");
    startTokenCirculation();
  } else {
    // Force token to move to next node
    moveTokenToNextNode();
    addLogEntry("Token manually advanced", "info");
  }
}

/**
 * Checks the overall health of the ring network
 * @returns {object} Health status object with detailed metrics
 */
function checkNetworkHealth() {
  const totalNodes = nodeCount;
  const activeNodes = Object.keys(nodeStatus).filter(nodeId => nodeStatus[nodeId]).length;
  const healthPercentage = totalNodes > 0 ? (activeNodes / totalNodes) * 100 : 0;
  
  // Check if ring is intact (all nodes in sequence are active)
  let ringIntact = true;
  for (let i = 0; i < nodeCount; i++) {
    const nodeId = getNodeIdFromIndex(i);
    if (!nodeStatus[nodeId]) {
      ringIntact = false;
      break;
    }
  }
  
  // Check connectivity between adjacent nodes
  let brokenConnections = 0;
  for (let i = 0; i < nodeCount; i++) {
    const currentNodeId = getNodeIdFromIndex(i);
    const nextNodeId = getNodeIdFromIndex((i + 1) % nodeCount);
    
    if (!nodeStatus[currentNodeId] || !nodeStatus[nextNodeId]) {
      brokenConnections++;
    }
  }
  
  return {
    totalNodes: totalNodes,
    activeNodes: activeNodes,
    inactiveNodes: totalNodes - activeNodes,
    healthPercentage: healthPercentage,
    ringIntact: ringIntact,
    brokenConnections: brokenConnections,
    tokenActive: tokenActive && tokenCirculating,
    lastUpdated: new Date().toISOString()
  };
}

/**
 * Auto-heal the ring by finding working paths
 */
function attemptRingHealing() {
  const health = checkNetworkHealth();
  
  if (health.ringIntact) {
    addLogEntry("Ring is healthy - no healing needed", "info");
    return true;
  }
  
  if (health.activeNodes < 3) {
    addLogEntry("Ring healing failed: Need at least 3 active nodes", "error");
    return false;
  }
  
  addLogEntry("Attempting ring healing...", "info");
  
  // Try to find a continuous path of active nodes
  let longestPath = [];
  for (let start = 0; start < nodeCount; start++) {
    const startNodeId = getNodeIdFromIndex(start);
    if (!nodeStatus[startNodeId]) continue;
    
    const path = [start];
    let current = start;
    
    for (let i = 1; i < nodeCount; i++) {
      const next = (current + 1) % nodeCount;
      const nextNodeId = getNodeIdFromIndex(next);
      
      if (nodeStatus[nextNodeId]) {
        path.push(next);
        current = next;
      } else {
        break;
      }
    }
    
    if (path.length > longestPath.length) {
      longestPath = path;
    }
  }
  
  if (longestPath.length >= 3) {
    addLogEntry(`Ring healing successful: Found active segment with ${longestPath.length} nodes`, "info");
    return true;
  } else {
    addLogEntry("Ring healing failed: No sufficient active segment found", "error");
    return false;
  }
}
