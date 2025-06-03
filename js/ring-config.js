// Ring Topology Configuration Constants
const NODE_ACTIVE = "#00ff41";
const NODE_INACTIVE = "#ff3366";
const EDGE_ACTIVE = "#00cc33";
const EDGE_INACTIVE = "#ff3366";
const PACKET_COLOR = "#39ff14";
const TOKEN_COLOR = "#ffff00";
const PACKET_SPEED = 800; // Base animation speed
const TOKEN_SPEED = 600; // Token circulation speed

// IP Configuration for Ring Nodes
const ipConfigurations = {
  node1: "192.168.1.10",
  node2: "192.168.1.11", 
  node3: "192.168.1.12",
  node4: "192.168.1.13",
  node5: "192.168.1.14",
  node6: "192.168.1.15",
  node7: "192.168.1.16",
  node8: "192.168.1.17",
};

// Global State Variables
let data; // vis.js DataSet
let network; // vis.js Network instance
let nodeStatus = {}; // e.g., { node1: true, node2: false }
let blinkInterval;
let isAnimatingPacket = false;
let autoSimulateInterval = null;
let packetElements = []; // For visual packet DOM elements
let packetLogEntries = []; // For log display
let nodeCount = 6; // Initial node count
let trafficData = {}; // Traffic monitoring per node
let lastBroadcastTime = 0;

// Ring-specific variables
let tokenPosition = 0; // Current token holder (node index)
let tokenElement = null; // DOM element for token visualization
let ringDirection = 1; // 1 for clockwise, -1 for counter-clockwise
let tokenActive = true; // Whether token is circulating
let tokenInterval = null; // Token circulation interval

// Auto simulation variables
let autoSimulationRunning = false;
let autoSimulationInterval = null;
let tokenCirculating = false;

// Advanced Feature State Variables
let packetQueue = []; // For processing packets sequentially
let currentLatency = 50; // in ms
let currentPacketSize = 64; // in bytes
let enableCollisions = true;
let activePackets = []; // Packets currently in transit
let collisionCount = 0;

// Load Test Metrics
let loadTestMetrics = {
  packetsSent: 0,
  packetsDelivered: 0,
  collisions: 0,
  deliveryTimes: [],
  startTime: 0
};

// Load test state
let loadTestActive = false;

// Ring-specific metrics
let ringMetrics = {
  tokenPasses: 0,
  ringBreaks: 0,
  tokenTimeouts: 0,
  averageTokenTime: 0
};

// Ring topology helper functions
function getNextNodeInRing(currentNodeIndex) {
  return (currentNodeIndex + ringDirection + nodeCount) % nodeCount;
}

function getPreviousNodeInRing(currentNodeIndex) {
  return (currentNodeIndex - ringDirection + nodeCount) % nodeCount;
}

function getNodeIndexFromId(nodeId) {
  return parseInt(nodeId.replace('node', '')) - 1;
}

function getNodeIdFromIndex(index) {
  return `node${index + 1}`;
}

// Check if ring is intact (no broken connections)
function isRingIntact() {
  for (let i = 0; i < nodeCount; i++) {
    const nodeId = getNodeIdFromIndex(i);
    if (!nodeStatus[nodeId]) {
      return false;
    }
  }
  return true;
}

// Get the path from source to target in ring topology
function getRingPath(sourceIndex, targetIndex) {
  const path = [];
  let current = sourceIndex;
  
  // Add source
  path.push(current);
  
  // Navigate around the ring
  while (current !== targetIndex) {
    current = getNextNodeInRing(current);
    path.push(current);
    
    // Safety check to prevent infinite loops
    if (path.length > nodeCount + 1) {
      console.error("Ring path calculation error - infinite loop detected");
      break;
    }
  }
  
  return path;
}

// Calculate shortest path considering ring topology
function getShortestRingPath(sourceIndex, targetIndex) {
  // Calculate clockwise distance
  let clockwiseDistance = (targetIndex - sourceIndex + nodeCount) % nodeCount;
  // Calculate counter-clockwise distance  
  let counterClockwiseDistance = (sourceIndex - targetIndex + nodeCount) % nodeCount;
  
  if (clockwiseDistance <= counterClockwiseDistance) {
    // Go clockwise
    const path = [];
    let current = sourceIndex;
    for (let i = 0; i <= clockwiseDistance; i++) {
      path.push(current);
      if (i < clockwiseDistance) {
        current = (current + 1) % nodeCount;
      }
    }
    return path;
  } else {    // Go counter-clockwise
    const path = [];
    let current = sourceIndex;
    for (let i = 0; i <= counterClockwiseDistance; i++) {
      path.push(current);
      if (i < counterClockwiseDistance) {
        current = (current - 1 + nodeCount) % nodeCount;
      }
    }
    return path;
  }
}

// Get alternative path (opposite direction) for bidirectional failover
function getAlternativeRingPath(sourceIndex, targetIndex) {
  // Calculate clockwise distance
  let clockwiseDistance = (targetIndex - sourceIndex + nodeCount) % nodeCount;
  // Calculate counter-clockwise distance  
  let counterClockwiseDistance = (sourceIndex - targetIndex + nodeCount) % nodeCount;
  
  // Return the LONGER path (opposite of shortest path)
  if (clockwiseDistance > counterClockwiseDistance) {
    // Go clockwise (longer path)
    const path = [];
    let current = sourceIndex;
    for (let i = 0; i <= clockwiseDistance; i++) {
      path.push(current);
      if (i < clockwiseDistance) {
        current = (current + 1) % nodeCount;
      }
    }
    return path;
  } else {
    // Go counter-clockwise (longer path)
    const path = [];
    let current = sourceIndex;
    for (let i = 0; i <= counterClockwiseDistance; i++) {
      path.push(current);
      if (i < counterClockwiseDistance) {
        current = (current - 1 + nodeCount) % nodeCount;
      }
    }
    return path;
  }
}

// Check if a path through the ring is viable (all nodes active)
function isPathViable(path) {
  for (const nodeIndex of path) {
    const nodeId = getNodeIdFromIndex(nodeIndex);
    if (!nodeStatus[nodeId]) {
      return false;
    }
  }
  return true;
}

// Get the best available path considering node status
function getBestAvailablePath(sourceIndex, targetIndex) {
  const shortestPath = getShortestRingPath(sourceIndex, targetIndex);
  const alternativePath = getAlternativeRingPath(sourceIndex, targetIndex);
  
  const shortestViable = isPathViable(shortestPath);
  const alternativeViable = isPathViable(alternativePath);
  
  if (shortestViable && alternativeViable) {
    // Both paths available, use shortest
    return { path: shortestPath, isAlternative: false };
  } else if (shortestViable) {
    // Only shortest path available
    return { path: shortestPath, isAlternative: false };
  } else if (alternativeViable) {
    // Only alternative path available
    return { path: alternativePath, isAlternative: true };
  } else {
    // No path available
    return { path: null, isAlternative: false };
  }
}
