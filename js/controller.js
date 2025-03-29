
/*

The purpose of this code is to implement controller support for
the Meta Quest 3, allowing movement with left joystick, and
snap turning with right joystick.
This Javascrpt code is not my own, please see reference below.

msub2, (2023), 'aframe-vr-character-controller',
Available at: https://github.com/msub2/aframe-vr-character-controller.
Accessed: 28th March 2025.

*/

AFRAME.registerComponent('smooth-locomotion', {
  schema: {
    speed: { type: 'float', default: 2 },
    active: { type: 'boolean', default: false },
    fly: { type: 'boolean', default: false },
  },
  init: function () {
    if (!this.data.active) return;

    // Get scene element references
    this.player = document.querySelector('#player');
    this.head = document.querySelector('#head');
    this.leftHand = document.querySelector('#controllerL');

    // Movement variables
    this.moveX = 0;
    this.moveY = 0;
    this.moveVector = new THREE.Vector3();
    this.headRot = new THREE.Euler(0, 0, 0, 'YXZ');

    // Add deadzone for thumbstick
    this.deadzone = 0.15;

    this.leftHand.addEventListener('axismove', event => {
      // Apply deadzone to thumbstick input
      const rawX = event.detail.axis[2] || event.detail.axis[0];
      const rawY = event.detail.axis[3] || event.detail.axis[1];
      
      this.moveX = Math.abs(rawX) > this.deadzone ? 
        (rawX - (Math.sign(rawX) * this.deadzone)) / (1 - this.deadzone) : 0;
      this.moveY = Math.abs(rawY) > this.deadzone ? 
        (rawY - (Math.sign(rawY) * this.deadzone)) / (1 - this.deadzone) : 0;
    });
  },
  tick: function (time, timeDelta) {
    if (!this.data.active || (this.moveX === 0 && this.moveY === 0)) return;
    this.move(timeDelta / 1000);
  },
  move: function (dt) {
    this.moveVector.set(this.moveX, 0, this.moveY).normalize();
    this.headRot.setFromQuaternion(this.head.object3D.quaternion);
    if (!this.data.fly) this.headRot.set(0, this.headRot.y, 0);
    
    const scaledMovement = this.moveVector.multiplyScalar(this.data.speed * dt);
    this.player.object3D.position.add(
      scaledMovement.applyEuler(this.headRot)
        .applyQuaternion(this.player.object3D.quaternion)
    );
  }
});

AFRAME.registerComponent('turn-controls', {
  schema: {
    turnType: { type: 'string', default: 'none' },
    snapDegrees: { type: 'float', default: 45 },
    turnSpeed: { type: 'float', default: 2 },
    deadzone: { type: 'float', default: 0.2 },
    cooldown: { type: 'int', default: 300 } // ms between snaps
  },
  init: function () {
    if (this.data.turnType === 'none') return;
    
    // Validate turn type
    if (this.data.turnType !== 'snap' && this.data.turnType !== 'smooth') {
      console.error("Invalid turnType! Only 'none', 'snap', and 'smooth' are accepted.");
      return;
    }

    // Get elements
    this.player = document.querySelector('#player');
    this.head = this.player.querySelector('#head');
    this.rightHand = document.querySelector('#controllerR');
    
    // Turn variables
    this.rotateX = 0;
    this.lastTurnTime = 0;
    
    // Position adjustment vectors
    this.lastHeadPos = new THREE.Vector3();
    this.newHeadPos = new THREE.Vector3();

    // Add visual indicator
    this.addTurnIndicator();
    
    // Thumbstick event with deadzone
    this.rightHand.addEventListener('axismove', (event) => {
      const rawValue = event.detail.axis[2] || event.detail.axis[0];
      // Apply deadzone
      this.rotateX = Math.abs(rawValue) > this.data.deadzone ? 
        (rawValue - (Math.sign(rawValue) * this.data.deadzone)) / (1 - this.data.deadzone) : 0;
    });
  },
  
  addTurnIndicator: function() {
    if (!document.querySelector('#turnIndicator')) {
      const indicator = document.createElement('a-ring');
      indicator.setAttribute('id', 'turnIndicator');
      indicator.setAttribute('radius-inner', '0.02');
      indicator.setAttribute('radius-outer', '0.03');
      indicator.setAttribute('position', '0 0 -0.1');
      indicator.setAttribute('rotation', '-90 0 0');
      indicator.setAttribute('material', 'color: grey; transparent: true; opacity: 0.5');
      indicator.setAttribute('visible', 'false');
      this.rightHand.appendChild(indicator);
    }
  },
  
  tick: function (time, timeDelta) {
    if (this.data.turnType === 'none') return;
    
    if (this.data.turnType === 'snap') this.snapTurn();
    if (this.data.turnType === 'smooth') this.smoothTurn(timeDelta / 1000);
  },
  
  snapTurn: function () {
    const now = Date.now();
    const timeSinceLastTurn = now - this.lastTurnTime;
    
    // Only turn if past cooldown and thumbstick pushed far enough
    if (timeSinceLastTurn > this.data.cooldown && Math.abs(this.rotateX) > 0.8) {
      // Store head position before turn
      this.lastHeadPos.setFromMatrixPosition(this.head.object3D.matrixWorld);
      
      // Calculate turn direction and amount
      const turnDirection = -Math.sign(this.rotateX);
      this.player.object3D.rotation.y += this.data.snapDegrees * (Math.PI/180) * turnDirection;
      
      // Update world matrix after rotation
      this.player.object3D.updateMatrixWorld();
      
      // Adjust position to compensate for head movement
      this.newHeadPos.setFromMatrixPosition(this.head.object3D.matrixWorld);
      this.player.object3D.position.add(this.lastHeadPos.sub(this.newHeadPos));
      
      // Update last turn time
      this.lastTurnTime = now;
      
      // Visual feedback
      const indicator = document.querySelector('#turnIndicator');
      if (indicator) {
        indicator.setAttribute('material', 'color', turnDirection > 0 ? 'red' : 'blue');
        indicator.setAttribute('visible', 'true');
        setTimeout(() => indicator.setAttribute('visible', 'false'), 200);
      }
      
      // Haptic feedback if available
      if (this.rightHand.components.haptics) {
        this.rightHand.components.haptics.pulse(0.5, 50);
      }
    }
  },
  
  smoothTurn: function (dt) {
    if (this.rotateX !== 0) {
      this.lastHeadPos.setFromMatrixPosition(this.head.object3D.matrixWorld);
      this.player.object3D.rotation.y += -this.rotateX * dt * this.data.turnSpeed;
      this.player.object3D.updateMatrixWorld();
      this.newHeadPos.setFromMatrixPosition(this.head.object3D.matrixWorld);
      this.player.object3D.position.add(this.lastHeadPos.sub(this.newHeadPos));
    }
  }
});

AFRAME.registerPrimitive('a-controller', {
  defaultComponents: {
    'smooth-locomotion': {},
    'turn-controls': {},
    'hand-controls': { hand: 'left', handModelStyle: 'lowPoly', color: '#ffcccc' },
    'oculus-touch-controls': {},
    'haptics': {}
  },
  mappings: {
    hand: 'hand-controls.hand',
    move: 'smooth-locomotion.active',
    speed: 'smooth-locomotion.speed',
    'turn-type': 'turn-controls.turnType',
    'snap-degrees': 'turn-controls.snapDegrees',
    'turn-deadzone': 'turn-controls.deadzone',
    'turn-cooldown': 'turn-controls.cooldown'
  }
});