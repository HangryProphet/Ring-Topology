/**
 * Creates the ring network topology with nodes connected in a circular pattern.
 * Each node connects to its two adjacent neighbors forming a ring.
 */
function createNetwork() {
  const nodes = [];
  const edges = [];
  const radius = 250;
  const center = { x: 0, y: 0 };

  // Create nodes in a circle
  for (let i = 0; i < nodeCount; i++) {
    const angle = (i * 2 * Math.PI) / nodeCount - Math.PI / 2; // Start from top
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    const nodeId = `node${i + 1}`;
    
    // Initialize traffic data for this node if it doesn't exist
    if (!trafficData[nodeId]) {
      trafficData[nodeId] = {
        packetsSent: 0,
        packetsReceived: 0,
        lastUpdate: Date.now()
      };
    }
    
    // Initialize node status if it doesn't exist
    if (nodeStatus[nodeId] === undefined) {
      nodeStatus[nodeId] = true;
    }
    
    // Get the IP (use existing or generate new)
    const nodeIP = ipConfigurations[nodeId] || generateIP(i + 1);
    
    // Make sure IP is in configurations
    if (!ipConfigurations[nodeId]) {
      ipConfigurations[nodeId] = nodeIP;
    }

    nodes.push({
      id: nodeId,
      label: `PC ${i + 1}\\n${nodeIP}`,
      shape: "image",
      image: "desktop.png",
      size: 40,
      font: { 
        size: 11, 
        color: NODE_ACTIVE,
        face: 'Courier New',
        strokeWidth: 2,
        strokeColor: '#000000'
      },
      fixed: true,
      x: x,
      y: y,
      borderWidth: 3,
      borderWidthSelected: 4,
      color: { 
        border: NODE_ACTIVE, 
        background: "rgba(0,0,0,0.8)" 
      },
      shadow: {
        enabled: true,
        color: NODE_ACTIVE,
        size: 15,
        x: 0,
        y: 0
      },
      chosen: {
        node: function(values, id, selected, hovering) {
          if (hovering || selected) {
            values.shadow = true;
            values.shadowColor = NODE_ACTIVE;
            values.shadowSize = 25;
          }
        }
      }
    });
  }

  // Create edges connecting nodes in a ring
  for (let i = 0; i < nodeCount; i++) {
    const fromNode = `node${i + 1}`;
    const toNode = `node${((i + 1) % nodeCount) + 1}`;
    
    const edgeId = `${fromNode}-${toNode}`;
    
    edges.push({
      id: edgeId,
      from: fromNode,
      to: toNode,
      color: {
        color: EDGE_ACTIVE,
        opacity: 0.8
      },
      width: 3,
      shadow: {
        enabled: true,
        color: EDGE_ACTIVE,
        size: 8
      },
      smooth: {
        enabled: false
      },
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 0.8,
          type: 'arrow'
        }
      },
      physics: false
    });
  }

  // If network already exists, destroy it first
  if (network) {
    network.destroy();
  }

  data = {
    nodes: new vis.DataSet(nodes),
    edges: new vis.DataSet(edges),
  };

  const options = {
    physics: false,
    interaction: {
      dragNodes: false,
      dragView: false,
      zoomView: false,
      selectConnectedEdges: false
    },
    autoResize: false,
    height: "100%",
    width: "100%",
    nodes: {
      chosen: true
    },
    edges: {
      chosen: false
    }
  };

  network = new vis.Network(document.getElementById("network"), data, options);

  // Handle node clicks
  network.on("click", (params) => {
    if (params.nodes.length > 0) {
      const nodeId = params.nodes[0];
      if (nodeId.startsWith('node')) {
        toggleNode(nodeId);
      }
    }
  });
  
  // Update node selectors in UI
  updateNodeSelectors();
  
  // Start token circulation if not already started
  if (!tokenInterval && tokenActive) {
    startTokenCirculation();
  }
}

/**
 * Updates the visual appearance of nodes and edges based on their current status.
 */
function updateVisuals() {
  // Update each node's visual state
  for (let i = 1; i <= nodeCount; i++) {
    const nodeId = `node${i}`;
    const node = data.nodes.get(nodeId);
    if (!node) continue;

    const isActive = nodeStatus[nodeId];
    const trafficLevel = getTrafficLevel(nodeId);
    
    if (isActive) {
      node.color.border = NODE_ACTIVE;
      node.shadow.color = NODE_ACTIVE;
      node.font.color = NODE_ACTIVE;
      
      // Apply traffic-based styling
      if (trafficLevel === 'high') {
        node.borderWidth = 5;
        node.shadow.size = 25;
      } else if (trafficLevel === 'medium') {
        node.borderWidth = 4;
        node.shadow.size = 20;
      } else {
        node.borderWidth = 3;
        node.shadow.size = 15;
      }
    } else {
      node.color.border = NODE_INACTIVE;
      node.shadow.color = NODE_INACTIVE;
      node.font.color = NODE_INACTIVE;
      node.borderWidth = 3;
      node.shadow.size = 15;
    }
    
    data.nodes.update(node);
  }

  // Update edge visual states
  for (let i = 0; i < nodeCount; i++) {
    const fromNodeId = `node${i + 1}`;
    const toNodeId = `node${((i + 1) % nodeCount) + 1}`;
    const edgeId = `${fromNodeId}-${toNodeId}`;
    const edge = data.edges.get(edgeId);
    
    if (!edge) continue;
    
    const fromActive = nodeStatus[fromNodeId];
    const toActive = nodeStatus[toNodeId];
    
    if (fromActive && toActive) {
      edge.color.color = EDGE_ACTIVE;
      edge.color.opacity = 0.8;
      edge.shadow.color = EDGE_ACTIVE;
      edge.width = 3;
    } else {
      edge.color.color = EDGE_INACTIVE;
      edge.color.opacity = 0.4;
      edge.shadow.color = EDGE_INACTIVE;
      edge.width = 2;
    }
    
    data.edges.update(edge);
  }

  updateStatusText();
  
  // Restart blinking for inactive edges
  if (blinkInterval) {
    clearInterval(blinkInterval);
  }
  blinkInactiveEdges();
}

/**
 * Makes inactive edges blink to visually indicate their status.
 */
function blinkInactiveEdges() {
  let toggle = false;
  clearInterval(blinkInterval);
  
  blinkInterval = setInterval(() => {
    toggle = !toggle;
    
    for (let i = 0; i < nodeCount; i++) {
      const fromNodeId = `node${i + 1}`;
      const toNodeId = `node${((i + 1) % nodeCount) + 1}`;
      const edgeId = `${fromNodeId}-${toNodeId}`;
      const edge = data.edges.get(edgeId);
      
      if (!edge) continue;
      
      const fromActive = nodeStatus[fromNodeId];
      const toActive = nodeStatus[toNodeId];
      
      if (!fromActive || !toActive) {
        edge.color.opacity = toggle ? 0.2 : 0.6;
        data.edges.update(edge);
      }
    }
  }, 500);
}

/**
 * Get traffic level for a node connection
 * @param {string} nodeId 
 * @returns {string} 'low', 'medium', or 'high'
 */
function getTrafficLevel(nodeId) {
  if (!trafficData[nodeId]) return 'low';
  
  const totalPackets = trafficData[nodeId].packetsSent + trafficData[nodeId].packetsReceived;
  const timeSinceStart = (Date.now() - trafficData[nodeId].lastUpdate) / 1000;
  
  // Reset traffic if it's been a while
  if (timeSinceStart > 60) {
    trafficData[nodeId].packetsSent = 0;
    trafficData[nodeId].packetsReceived = 0;
    trafficData[nodeId].lastUpdate = Date.now();
    return 'low';
  }
  
  // Calculate packets per second
  const packetsPerSecond = totalPackets / Math.max(timeSinceStart, 1);
  
  if (packetsPerSecond > 0.5) return 'high';
  if (packetsPerSecond > 0.2) return 'medium';
  return 'low';
}

/**
 * Start token circulation around the ring
 */
function startTokenCirculation() {
  if (tokenInterval) {
    clearInterval(tokenInterval);
  }
  
  // Ensure token state variables are set
  tokenActive = true;
  tokenCirculating = true;
  
  // Create token element if it doesn't exist or if network was rebuilt
  if (!tokenElement || !document.contains(tokenElement)) {
    createTokenElement();
  } else {
    // Make sure existing token is visible
    tokenElement.style.display = 'block';
  }
  
  tokenInterval = setInterval(() => {
    if (tokenActive && tokenCirculating && isRingIntact()) {
      moveTokenToNextNode();
    } else if (!isRingIntact()) {
      // Ring is broken, pause token
      if (tokenElement) {
        tokenElement.style.display = 'none';
      }
      addLogEntry("Token circulation paused - ring is broken", "error");
    }
  }, TOKEN_SPEED);
}

/**
 * Stop token circulation
 */
function stopTokenCirculation() {
  if (tokenInterval) {
    clearInterval(tokenInterval);
    tokenInterval = null;
  }
  
  tokenActive = false;
  tokenCirculating = false;
  
  if (tokenElement) {
    tokenElement.style.display = 'none';
  }
  
  if (tokenElement) {
    tokenElement.style.display = 'none';
  }
}

/**
 * Create visual token element
 */
function createTokenElement() {
  // Remove existing token if any
  if (tokenElement && document.contains(tokenElement)) {
    tokenElement.remove();
  }
  
  // Create new token element
  tokenElement = document.createElement('div');
  tokenElement.className = 'token token-active';
  tokenElement.setAttribute('id', 'ringToken');
  tokenElement.style.cssText = `
    position: absolute;
    width: 20px;
    height: 20px;
    background: radial-gradient(circle, #ffff00, #ffaa00);
    border: 2px solid #ffffff;
    border-radius: 50%;
    box-shadow: 0 0 15px #ffff00, inset 0 0 5px rgba(255,255,255,0.4);
    z-index: 1001;
    transform: translate(-50%, -50%);
    pointer-events: none;
    display: ${tokenActive ? 'block' : 'none'};
  `;
  
  // Append to network container
  const networkDiv = document.querySelector('#network');
  if (networkDiv) {
    networkDiv.appendChild(tokenElement);
    addLogEntry(`Token created at position ${tokenPosition + 1} [${tokenActive ? 'ACTIVE' : 'INACTIVE'}]`, "info");
  } else {
    console.error("Network container not found");
  }
  
  // Position token at first active node
  updateTokenPosition();
}

/**
 * Move token to next node in ring
 */
function moveTokenToNextNode() {
  let nextPosition;
  let attempts = 0;
  
  do {
    nextPosition = getNextNodeInRing(tokenPosition);
    tokenPosition = nextPosition;
    attempts++;
  } while (!nodeStatus[getNodeIdFromIndex(tokenPosition)] && attempts < nodeCount);
  
  if (attempts >= nodeCount) {
    // No active nodes found
    stopTokenCirculation();
    addLogEntry("No active nodes found - stopping token circulation", "error");
    return;
  }
  
  updateTokenPosition();
  ringMetrics.tokenPasses++;
  
  const currentNodeId = getNodeIdFromIndex(tokenPosition);
  addLogEntry(`Token at ${currentNodeId.replace('node', 'PC ')} (${ipConfigurations[currentNodeId]})`, "info");
}

/**
 * Update token visual position
 */
function updateTokenPosition() {
  // Check if token element exists or needs to be created
  if (!tokenElement || !document.getElementById('ringToken')) {
    console.log("⚠️ Token element not available, recreating...");
    createTokenElement();
    return;
  }
  
  // If network isn't ready yet
  if (!network) {
    console.log("⚠️ Network not initialized yet");
    return;
  }
  
  // Handle token visibility based on token state
  tokenElement.style.display = tokenActive ? 'block' : 'none';
  
  // If token is not active, no need to position it
  if (!tokenActive) return;
  
  // Get the current node where the token should be positioned
  const nodeId = getNodeIdFromIndex(tokenPosition);
  const positions = network.getPositions([nodeId]);
  
  // Check if the node position is available
  if (!positions || !positions[nodeId]) {
    console.log(`⚠️ Node position not found for ${nodeId}, trying to recover...`);
    
    // Try to find the next valid node
    for (let i = 0; i < nodeCount; i++) {
      const altNodeId = getNodeIdFromIndex(i);
      const altPositions = network.getPositions([altNodeId]);
      if (altPositions && altPositions[altNodeId]) {
        tokenPosition = i;
        updateTokenPosition(); // Recursive call with valid position
        return;
      }
    }
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

  // Apply position with a slight offset above the node for better visibility
  tokenElement.style.left = `${x}px`;
  tokenElement.style.top = `${y - 30}px`;
  tokenElement.style.display = 'block';
  
  // Add a subtle pulse animation when token moves
  tokenElement.classList.add('token-pulse');
  setTimeout(() => {
    tokenElement.classList.remove('token-pulse');
  }, 300);
  
  // Log token position
  console.log(`🟡 Token positioned at ${nodeId} (${x}, ${y})`);
}
