import './style.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <canvas id="game" width="1500" height="1200"></canvas>
`;

// Initialiser le jeu après que le canvas soit dans le DOM
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Charger l'image de l'oiseau et créer une version sans fond blanc
const birdImage = new Image();
birdImage.src = './Images/bird.png';

// Canvas temporaire pour enlever le fond blanc
const birdCanvas = document.createElement('canvas');
const birdCtx = birdCanvas.getContext('2d');
let birdImageProcessed = false;

birdImage.onload = function() {
  birdCanvas.width = birdImage.width;
  birdCanvas.height = birdImage.height;
  
  // Dessiner l'image originale
  birdCtx.drawImage(birdImage, 0, 0);
  
  // Obtenir les données de l'image
  const imageData = birdCtx.getImageData(0, 0, birdCanvas.width, birdCanvas.height);
  const data = imageData.data;
  
  // Rendre le blanc transparent (pixels proches du blanc)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Si le pixel est proche du blanc (seuil ajustable)
    if (r > 240 && g > 240 && b > 240) {
      data[i + 3] = 0; // Rendre transparent
    }
  }
  
  // Remettre les données modifiées
  birdCtx.putImageData(imageData, 0, 0);
  birdImageProcessed = true;
};

// ==========================
// CRÉATION DE LA TEXTURE D'HERBE (une seule fois)
// ==========================
const grassTextureCanvas = document.createElement('canvas');
grassTextureCanvas.width = 256;
grassTextureCanvas.height = 64;

const gctx = grassTextureCanvas.getContext('2d');

// Dégradé de base
const grad = gctx.createLinearGradient(0, 0, 0, 64);
grad.addColorStop(0, '#7fdc4d');
grad.addColorStop(1, '#2f7d19');
gctx.fillStyle = grad;
gctx.fillRect(0, 0, 256, 64);

// Noise / variations
for (let i = 0; i < 1200; i++) {
  const x = Math.random() * 256;
  const y = Math.random() * 64;
  const alpha = Math.random() * 0.15;

  gctx.fillStyle = `rgba(0,0,0,${alpha})`;
  gctx.fillRect(x, y, 2, 2);
}

// Brins stylisés
for (let i = 0; i < 200; i++) {
  const x = Math.random() * 256;
  const h = 6 + Math.random() * 10;

  gctx.strokeStyle = '#1f5f12';
  gctx.lineWidth = 1;
  gctx.beginPath();
  gctx.moveTo(x, 64);
  gctx.lineTo(x + Math.random() * 4 - 2, 64 - h);
  gctx.stroke();
}


const groundHeight = 20; // Épaisseur du sol
const grassHeight = 15; // Hauteur de la couche d'herbe
const dirtHeight = 10; // Hauteur de la couche de terre


const size = 70; // Taille du carré
const x = 750; // Position horizontale (centré pour canvas 1500px)
let y = 1050; // Position verticale (variable pour le saut)
let velocityY = 0; // Vélocité verticale
const gravity = 0.5; // Gravité
const jumpStrength = -14; // Force du saut (augmentée pour sauter plus haut)
const groundY = 1100; // Position du sol (plus bas dans le canvas)
let rotationAngle = 0; // Angle de rotation du carré
let wasOnGround = true; // Pour détecter le début d'un nouveau saut
let scrollSpeed = 3; // Vitesse de défilement du sol (augmente avec le score)
let groundOffset = 0; // Offset pour le défilement du sol
let globalOffset = 0; // Offset global qui ne se réinitialise jamais
let birdOffset = 0; // Offset indépendant pour les oiseaux (avance plus vite)
const birdSpeedMultiplier = 1.6; // Les oiseaux avancent 1.6x plus vite que le sol
let speedLevel = 0; // Niveau de vitesse actuel (augmente tous les 500 points)

// Offsets pour les couches de montagnes (style Alto)
const farOffset = { value: 0 };
const midOffset = { value: 0 };
const nearOffset = { value: 0 };

// Obstacles (pierres)
let obstacles = [];
const minObstacleWidth = 30;
const maxObstacleWidth = 48;
const minObstacleHeight = 50;
const maxObstacleHeight = 85; // Roches agrandies mais pas à 100
let nextObstacleX = 1000; // Position du prochain obstacle (initialisé après)
const minObstacleGap = 350; // Distance minimale entre les obstacles
const maxObstacleGap = 550; // Distance maximale entre les obstacles (aléatoire)

// Couleurs des pierres
const stoneColors = [
  '#8B7355', // Marron
  '#696969', // Gris foncé
  '#A9A9A9', // Gris moyen
  '#6B6B6B', // Gris ardoise
  '#8B7D6B', // Beige
  '#5C5C5C'  // Gris charbon
];

// Oiseaux
let birds = [];
const birdWidth = 150; // Largeur de l'oiseau (agrandie)
const birdHeight = 110; // Hauteur de l'oiseau (agrandie)
let nextBirdX = 1200; // Position du prochain oiseau
const minBirdGap = 1800; // Distance minimale entre les oiseaux
const maxBirdGap = 3000; // Distance maximale entre les oiseaux
const minBirdY = 900; // Hauteur minimale (très basse, proche du sol)
const maxBirdY = 1000; // Hauteur maximale (encore assez basse)

// État du jeu
let inMainMenu = true; // Menu principal
let gameOver = false;
let isPaused = false;
let pauseStartTime = 0; // Temps de début de la pause
const pauseDuration = 10000; // 10 secondes en millisecondes
let score = 0;
let lives = 2;
let lastHitTime = 0;
const invincibilityTime = 2000; // 2 secondes d'invincibilité après avoir perdu une vie

// Variables pour l'animation du menu principal
let menuOffset = 0; // Offset pour l'animation du menu

// Système de record
let record = 0;
// Charger le record depuis le localStorage
function loadRecord() {
  const savedRecord = localStorage.getItem('adamGameRecord');
  if (savedRecord) {
    record = parseInt(savedRecord, 10);
  }
}
// Sauvegarder le record dans le localStorage
function saveRecord() {
  if (score > record) {
    record = score;
    localStorage.setItem('adamGameRecord', record.toString());
  }
}
// Initialiser le record au chargement
loadRecord();

// Fonction de détection de collision
function checkCollision() {
  const currentTime = Date.now();
  // Vérifier l'invincibilité
  if (currentTime - lastHitTime < invincibilityTime) {
    return false;
  }

  const playerLeft = x - size/2;
  const playerRight = x + size/2;
  const playerTop = y - size/2;
  const playerBottom = y + size/2;

  for (const obstacle of obstacles) {
    const obstacleScreenX = obstacle.x - globalOffset;
    const obstacleLeft = obstacleScreenX;
    const obstacleRight = obstacleScreenX + obstacle.width;
    const obstacleTop = groundY - obstacle.height;
    const obstacleBottom = groundY;

    // Collision uniquement sur le côté droit du joueur
    // L'obstacle doit toucher le côté droit du joueur (playerRight)
    const touchesRightSide = obstacleLeft <= playerRight && 
                             obstacleRight >= playerRight;
    const verticalOverlap = playerBottom > obstacleTop && 
                          playerTop < obstacleBottom;
    
    // Collision seulement si l'obstacle touche le côté droit du joueur
    // ET qu'il y a un chevauchement vertical
    // ET que le joueur n'est pas complètement au-dessus (saut réussi)
    if (touchesRightSide && verticalOverlap) {
      // Si le joueur est au-dessus de l'obstacle (saut réussi), pas de collision
      if (playerBottom <= obstacleTop + 5) {
        continue; // Le joueur a sauté par-dessus
      }
      return true;
    }
  }

  // Vérifier les collisions avec les oiseaux
  for (const bird of birds) {
    const birdScreenX = bird.x - birdOffset;
    
    // Centre de l'oiseau
    const birdCenterX = birdScreenX + birdWidth / 2;
    const birdCenterY = bird.y + birdHeight / 2;
    
    // Centre du joueur
    const playerCenterX = x;
    const playerCenterY = y;
    
    // Calculer la distance entre les centres
    const dx = playerCenterX - birdCenterX;
    const dy = playerCenterY - birdCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Collision seulement si le joueur est dans un rayon de 20 pixels du centre de l'oiseau
    if (distance <= 40) {
      return true;
    }
  }

  return false;
}

// Fonction pour mettre à jour le score basé sur la distance parcourue
function updateScore() {
  // Le score augmente avec la distance parcourue (basé sur globalOffset)
  score = Math.floor(globalOffset / 10);
  
  // Augmenter la vitesse tous les 100 points
  const newSpeedLevel = Math.floor(score / 100);
  if (newSpeedLevel > speedLevel) {
    speedLevel = newSpeedLevel;
    scrollSpeed = 3 + (speedLevel * 0.28); // Augmente de 0.5 tous les 500 points
  }
}

// Fonction pour dessiner une couche de montagnes (style Alto)
function drawMountainLayer({
  y,
  height,
  color,
  offset,
  speed
}) {
  offset.value -= scrollSpeed * speed;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, y + height);

  const points = 6;
  for (let i = 0; i <= points; i++) {
    const x = (i / points) * canvas.width;
    const curve = Math.sin(i * 1.3 + offset.value * 0.002) * height * 0.4;
    ctx.lineTo(x, y + curve);
  }

  ctx.lineTo(canvas.width, y + height);
  ctx.closePath();
  ctx.fill();
}

// Fonction pour réinitialiser le jeu
function resetGame() {
  inMainMenu = false;
  gameOver = false;
  isPaused = false;
  pauseStartTime = 0;
  y = groundY - size/2;
  velocityY = 0;
  obstacles = [];
  birds = [];
  globalOffset = 0;
  groundOffset = 0;
  birdOffset = 0;
  nextObstacleX = canvas.width + 200;
  nextBirdX = canvas.width + 300;
  score = 0;
  lives = 2;
  lastHitTime = 0;
  scrollSpeed = 3; // Réinitialiser la vitesse
  speedLevel = 0; // Réinitialiser le niveau de vitesse
  farOffset.value = 0; // Réinitialiser les offsets des montagnes
  midOffset.value = 0;
  nearOffset.value = 0;
  rotationAngle = 0; // Réinitialiser la rotation
  wasOnGround = true; // Réinitialiser l'état au sol
  menuOffset = 0; // Réinitialiser l'offset du menu
}

function draw() {
  // Menu principal
  if (inMainMenu) {
    // Animer l'arrière-plan automatiquement
    menuOffset += 2; // Vitesse de défilement du menu
    
    // Dessiner l'arrière-plan du jeu (ciel, montagnes, sol)
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#cfe8f3');
    sky.addColorStop(1, '#8fbcd4');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Montagnes avec animation
    const farOffsetValue = menuOffset * 0.02;
    const midOffsetValue = menuOffset * 0.04;
    const nearOffsetValue = menuOffset * 0.07;
    
    // Très lointain
    ctx.fillStyle = '#d6e2ea';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.45 + 300);
    for (let i = 0; i <= 6; i++) {
      const x = (i / 6) * canvas.width;
      const curve = Math.sin(i * 1.3 + farOffsetValue * 0.002) * 300 * 0.4;
      ctx.lineTo(x, canvas.height * 0.45 + curve);
    }
    ctx.lineTo(canvas.width, canvas.height * 0.45 + 300);
    ctx.closePath();
    ctx.fill();
    
    // Intermédiaire
    ctx.fillStyle = '#b7c9d6';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.55 + 260);
    for (let i = 0; i <= 6; i++) {
      const x = (i / 6) * canvas.width;
      const curve = Math.sin(i * 1.3 + midOffsetValue * 0.002) * 260 * 0.4;
      ctx.lineTo(x, canvas.height * 0.55 + curve);
    }
    ctx.lineTo(canvas.width, canvas.height * 0.55 + 260);
    ctx.closePath();
    ctx.fill();
    
    // Proche
    ctx.fillStyle = '#8fa6b8';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height * 0.65 + 220);
    for (let i = 0; i <= 6; i++) {
      const x = (i / 6) * canvas.width;
      const curve = Math.sin(i * 1.3 + nearOffsetValue * 0.002) * 220 * 0.4;
      ctx.lineTo(x, canvas.height * 0.65 + curve);
    }
    ctx.lineTo(canvas.width, canvas.height * 0.65 + 220);
    ctx.closePath();
    ctx.fill();
    
    // Remplir l'espace entre les montagnes et le sol
    ctx.fillStyle = '#8fa6b8';
    ctx.fillRect(0, canvas.height * 0.65 + 220, canvas.width, groundY - (canvas.height * 0.65 + 220));
    
    // Sol animé
    const menuGroundOffset = menuOffset % grassTextureCanvas.width;
    ctx.fillStyle = '#4b3315';
    ctx.fillRect(0, groundY + groundHeight, canvas.width, 50);
    
    // Herbe (texture répétée)
    for (let x = menuGroundOffset % grassTextureCanvas.width - grassTextureCanvas.width;
         x < canvas.width;
         x += grassTextureCanvas.width) {
      ctx.drawImage(
        grassTextureCanvas,
        x,
        groundY,
        grassTextureCanvas.width,
        groundHeight
      );
    }
    
    // Bord sombre
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, groundY, canvas.width, 4);
    
    // Overlay semi-transparent pour le menu
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Titre "START THE GAME"
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 100px Impact, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 8;
    ctx.strokeText('START THE GAME', canvas.width / 2, canvas.height / 2 - 100);
    ctx.fillText('START THE GAME', canvas.width / 2, canvas.height / 2 - 100);
    
    // Afficher le record
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 50px Arial';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 4;
    ctx.strokeText(`Record: ${record}`, canvas.width / 2, canvas.height / 2 + 50);
    ctx.fillText(`Record: ${record}`, canvas.width / 2, canvas.height / 2 + 50);
    
    // Instructions
    ctx.fillStyle = 'white';
    ctx.font = 'bold 30px Arial';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeText('Cliquez pour commencer', canvas.width / 2, canvas.height / 2 + 120);
    ctx.fillText('Cliquez pour commencer', canvas.width / 2, canvas.height / 2 + 120);
    
    requestAnimationFrame(draw);
    return;
  }
  
  if (isPaused && !gameOver) {
    // Vérifier si le minuteur est écoulé
    const currentTime = Date.now();
    const elapsedTime = currentTime - pauseStartTime;
    const remainingTime = Math.max(0, pauseDuration - elapsedTime);
    const remainingSeconds = Math.ceil(remainingTime / 1000);
    
    // Si le temps est écoulé, game over
    if (remainingTime <= 0) {
      gameOver = true;
      isPaused = false;
      pauseStartTime = 0;
      // Sauvegarder le record si c'est un nouveau record
      saveRecord();
    }
    
    // Afficher l'écran de pause
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // "PAUSE" en gros
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 120px Impact, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    
    // Contour noir épais pour "PAUSE"
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 10;
    ctx.strokeText('PAUSE', canvas.width / 2, canvas.height / 2 - 50);
    ctx.fillText('PAUSE', canvas.width / 2, canvas.height / 2 - 50);
    
    // Minuteur
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 80px Impact, Arial Black, sans-serif';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 8;
    ctx.strokeText(`${remainingSeconds}`, canvas.width / 2, canvas.height / 2 + 20);
    ctx.fillText(`${remainingSeconds}`, canvas.width / 2, canvas.height / 2 + 20);
    
    // Instructions
    ctx.fillStyle = 'white';
    ctx.font = 'bold 40px Arial';
    ctx.fillText('Appuyez sur Espace pour reprendre', canvas.width / 2, canvas.height / 2 + 80);
    
    // Bouton Restart (bouton classique)
    const restartButtonX = canvas.width / 2 - 120;
    const restartButtonY = canvas.height / 2 + 120;
    const restartButtonWidth = 240;
    const restartButtonHeight = 70;
    
    // Fond du bouton avec dégradé
    const buttonGradient = ctx.createLinearGradient(
      restartButtonX, restartButtonY,
      restartButtonX, restartButtonY + restartButtonHeight
    );
    buttonGradient.addColorStop(0, 'rgba(100, 100, 100, 0.8)');
    buttonGradient.addColorStop(1, 'rgba(50, 50, 50, 0.8)');
    ctx.fillStyle = buttonGradient;
    ctx.fillRect(restartButtonX, restartButtonY, restartButtonWidth, restartButtonHeight);
    
    // Bordure du bouton
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.strokeRect(restartButtonX, restartButtonY, restartButtonWidth, restartButtonHeight);
    
    // Texte "Restart" centré
    ctx.fillStyle = 'white';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Restart', canvas.width / 2, restartButtonY + restartButtonHeight / 2 + 12);
    
    requestAnimationFrame(draw);
    return;
  }
  
  if (gameOver) {
    // Afficher l'écran de game over
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // "GAME OVER" en très gros avec une police différente
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 180px Impact, Arial Black, sans-serif';
    ctx.textAlign = 'center';
    
    // Contour noir épais pour "GAME OVER"
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 12;
    ctx.strokeText('GAME OVER', canvas.width / 2, canvas.height / 2 - 100);
    ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2 - 100);
    
    // Score final
    ctx.fillStyle = 'white';
    ctx.font = 'bold 56px Arial';
    ctx.fillText(`Score final: ${score}`, canvas.width / 2, canvas.height / 2 + 100);
    
    // Afficher si c'est un nouveau record
    if (score === record && score > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 48px Arial';
      ctx.fillText('🎉 NOUVEAU RECORD ! 🎉', canvas.width / 2, canvas.height / 2 + 160);
    }
    
    // Afficher le record
    ctx.fillStyle = '#cccccc';
    ctx.font = 'bold 44px Arial';
    ctx.fillText(`Record: ${record}`, canvas.width / 2, canvas.height / 2 + 220);
    
    // Instructions
    ctx.fillStyle = 'white';
    ctx.font = '40px Arial';
    ctx.fillText('Appuyez sur Espace pour recommencer', canvas.width / 2, canvas.height / 2 + 280);
    
    requestAnimationFrame(draw);
    return;
  }

  // ==========================
  // CIEL "ALTO-LIKE"
  // ==========================
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, '#cfe8f3');
  sky.addColorStop(1, '#8fbcd4');

  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ==========================
  // MONTAGNES ABSTRAITES (STYLE ALTO)
  // ==========================
  
  // Très lointain
  drawMountainLayer({
    y: canvas.height * 0.45,
    height: 300,
    color: '#d6e2ea',
    offset: farOffset,
    speed: 0.02
  });

  // Intermédiaire
  drawMountainLayer({
    y: canvas.height * 0.55,
    height: 260,
    color: '#b7c9d6',
    offset: midOffset,
    speed: 0.04
  });

  // Proche
  drawMountainLayer({
    y: canvas.height * 0.65,
    height: 220,
    color: '#8fa6b8',
    offset: nearOffset,
    speed: 0.07
  });

  // Remplir l'espace entre les montagnes et le sol avec la couleur de la montagne rapprochée
  ctx.fillStyle = '#8fa6b8';
  ctx.fillRect(0, canvas.height * 0.65 + 220, canvas.width, groundY - (canvas.height * 0.65 + 220));

  // Déplacer le sol vers la gauche (seulement si pas en pause)
  if (!isPaused) {
    globalOffset += scrollSpeed;
    groundOffset -= scrollSpeed;
    
    // Déplacer les oiseaux indépendamment (plus vite que le sol)
    birdOffset += scrollSpeed * birdSpeedMultiplier;
  }
  
  // Réinitialiser l'offset quand il sort complètement de l'écran
  if (groundOffset <= -canvas.width) {
    groundOffset = 0;
  }

  // ==========================
  // SOL AVANCÉ – TEXTURE RÉPÉTÉE
  // ==========================

  // Remplir l'espace en bas du canvas avec la couleur brune
  ctx.fillStyle = '#4b3315';
  ctx.fillRect(0, groundY + groundHeight + 50, canvas.width, canvas.height - (groundY + groundHeight + 50));

  // Terre
  ctx.fillStyle = '#4b3315';
  ctx.fillRect(0, groundY + groundHeight, canvas.width, 50);

  // Herbe (texture répétée)
  for (let x = groundOffset % grassTextureCanvas.width - grassTextureCanvas.width;
       x < canvas.width;
       x += grassTextureCanvas.width) {

    ctx.drawImage(
      grassTextureCanvas,
      x,
      groundY,
      grassTextureCanvas.width,
      groundHeight
    );
  }

  // Répétition pour le défilement continu
  for (let x = (groundOffset + canvas.width) % grassTextureCanvas.width - grassTextureCanvas.width;
       x < canvas.width;
       x += grassTextureCanvas.width) {

    ctx.drawImage(
      grassTextureCanvas,
      x,
      groundY,
      grassTextureCanvas.width,
      groundHeight
    );
  }

  // Bord sombre
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, groundY, canvas.width, 4);

  // Générer de nouveaux obstacles (pierres) - seulement si pas en pause
  if (!isPaused && nextObstacleX - globalOffset < canvas.width + 100) {
    const random = Math.random();
    let packSize = 1; // Par défaut, une seule pierre
    
    // Décider aléatoirement le type de paquet
    if (score >= 2000) {
      // À partir du score 2000 : paquets de 6 roches possibles, minimum 2 roches
      if (random < 0.08) {
        // Paquet de 6 roches (8% de chance - augmenté)
        packSize = 6;
      } else if (random < 0.18) {
        // Paquet de 5 roches (10% de chance - augmenté)
        packSize = 5;
      } else if (random < 0.32) {
        // Paquet de 4 roches (14% de chance - augmenté)
        packSize = 4;
      } else if (random < 0.50) {
        // Paquet de 3 roches (18% de chance - augmenté)
        packSize = 3;
      } else {
        // Paquet de 2 roches (50% de chance - minimum)
        packSize = 2;
      }
    } else if (score >= 1880) {
      // À partir du score 1880 : paquets de 5 roches possibles, minimum 2 roches
      if (random < 0.10) {
        // Paquet de 5 roches (10% de chance - augmenté)
        packSize = 5;
      } else if (random < 0.22) {
        // Paquet de 4 roches (12% de chance - augmenté)
        packSize = 4;
      } else if (random < 0.40) {
        // Paquet de 3 roches (18% de chance - augmenté)
        packSize = 3;
      } else {
        // Paquet de 2 roches (60% de chance - minimum)
        packSize = 2;
      }
    } else if (score >= 1500) {
      // À partir du score 1500 : plus de paquets de 3 et 4, minimum 2 roches
      if (random < 0.15) {
        // Paquet de 4 roches (15% de chance - augmenté)
        packSize = 4;
      } else if (random < 0.35) {
        // Paquet de 3 roches (20% de chance - augmenté)
        packSize = 3;
      } else {
        // Paquet de 2 roches (65% de chance - minimum)
        packSize = 2;
      }
    } else if (score >= 500) {
      // À partir du score 500 : plus de roches uniques, minimum 2 roches
      if (random < 0.05) {
        // Paquet de 4 roches (5% de chance - augmenté)
        packSize = 4;
      } else if (random < 0.20) {
        // Paquet de 3 roches (15% de chance - augmenté)
        packSize = 3;
      } else {
        // Paquet de 2 roches (80% de chance - minimum)
        packSize = 2;
      }
    } else if (score >= 450) {
      // Entre score 450 et 500
      if (random < 0.02) {
        // Paquet de 4 roches (2% de chance - très rare)
        packSize = 4;
      } else if (random < 0.07) {
        // Paquet de 3 roches (5% de chance)
        packSize = 3;
      } else if (random < 0.37) {
        // Paquet de 2 roches (30% de chance)
        packSize = 2;
      }
      // Sinon packSize reste à 1 (63% de chance)
    } else {
      // Avant le score 450
      if (random < 0.30) {
        // Paquet de 2 roches (30% de chance)
        packSize = 2;
      }
      // Sinon packSize reste à 1 (70% de chance)
    }
    
    // Créer le paquet ou la pierre unique
    for (let i = 0; i < packSize; i++) {
      const width = minObstacleWidth + Math.random() * (maxObstacleWidth - minObstacleWidth);
      const height = minObstacleHeight + Math.random() * (maxObstacleHeight - minObstacleHeight);
      const color = stoneColors[Math.floor(Math.random() * stoneColors.length)];
      
      obstacles.push({
        x: nextObstacleX,
        width: width,
        height: height,
        color: color,
        avoided: false
      });
      
      // Les roches sont collées (pas d'espace entre elles)
      nextObstacleX += width;
    }
    
    // Espacement après le paquet ou la pierre unique
    // Augmenter l'espacement avec la vitesse pour rendre le jeu plus difficile mais jouable
    let currentMinGap = minObstacleGap;
    let currentMaxGap = maxObstacleGap;
    
    // Calculer l'augmentation d'espacement basée sur la vitesse
    // Plus la vitesse est élevée, plus l'espacement augmente
    const speedMultiplier = (scrollSpeed - 3) * 0.4; // Facteur d'augmentation basé sur la vitesse
    currentMinGap += speedMultiplier * 50; // Augmenter l'espacement minimum
    currentMaxGap += speedMultiplier * 80; // Augmenter l'espacement maximum
    
    // S'assurer que l'espacement ne devient pas trop petit
    currentMinGap = Math.max(currentMinGap, minObstacleGap);
    currentMaxGap = Math.max(currentMaxGap, maxObstacleGap);
    
    nextObstacleX += currentMinGap + Math.random() * (currentMaxGap - currentMinGap);
  }

  // Déplacer et dessiner les pierres
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
    
    // Dessiner la pierre sur le sol (position relative à l'offset global)
    const obstacleY = groundY - obstacle.height;
    const obstacleScreenX = obstacle.x - globalOffset;
    
    // Utiliser un clipping pour couper ce qui est dans le sol
    ctx.save();
    ctx.beginPath();
    ctx.rect(obstacleScreenX, 0, obstacle.width, groundY);
    ctx.clip();
    
    // Dessiner la pierre avec une forme légèrement irrégulière
    ctx.fillStyle = obstacle.color;
    ctx.beginPath();
    ctx.moveTo(obstacleScreenX + obstacle.width * 0.1, obstacleY);
    ctx.lineTo(obstacleScreenX + obstacle.width * 0.9, obstacleY);
    ctx.lineTo(obstacleScreenX + obstacle.width, obstacleY + obstacle.height * 0.3);
    ctx.lineTo(obstacleScreenX + obstacle.width * 0.95, obstacleY + obstacle.height);
    ctx.lineTo(obstacleScreenX + obstacle.width * 0.05, obstacleY + obstacle.height);
    ctx.lineTo(obstacleScreenX, obstacleY + obstacle.height * 0.3);
    ctx.closePath();
    ctx.fill();
    
    // Ajouter des détails (ombres/highlights) pour donner du relief
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(obstacleScreenX + obstacle.width * 0.1, obstacleY, obstacle.width * 0.3, obstacle.height * 0.2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(obstacleScreenX + obstacle.width * 0.6, obstacleY + obstacle.height * 0.5, obstacle.width * 0.4, obstacle.height * 0.5);
    
    // Restaurer le contexte (enlever le clipping)
    ctx.restore();
    
    // Supprimer les obstacles qui sont sortis de l'écran
    if (obstacleScreenX < -obstacle.width) {
      obstacles.splice(i, 1);
    }
  }

  // Générer de nouveaux oiseaux - seulement si pas en pause
  if (!isPaused && nextBirdX - birdOffset < canvas.width + 100) {
    // Vérifier s'il y a un obstacle qui sera à l'écran en même temps que l'oiseau
    // Les oiseaux avancent plus vite (birdSpeedMultiplier), donc on doit prédire où ils seront
    let hasObstacleNearby = false;
    const birdScreenX = nextBirdX - birdOffset;
    
    for (const obstacle of obstacles) {
      const obstacleScreenX = obstacle.x - globalOffset;
      
      // Vérifier si l'obstacle sera visible à l'écran en même temps que l'oiseau
      // (dans une zone de 300 pixels autour de la position de l'oiseau)
      const distance = Math.abs(obstacleScreenX - birdScreenX);
      
      // Si un obstacle est proche (dans une zone de 300 pixels)
      if (distance < 300 && obstacleScreenX > -100 && obstacleScreenX < canvas.width + 100) {
        hasObstacleNearby = true;
        break;
      }
    }
    
    // Toujours générer l'oiseau avec une hauteur aléatoire
    // Si obstacle proche, placer l'oiseau plus haut pour laisser de l'espace pour sauter
    let birdY;
    if (hasObstacleNearby) {
      // Si obstacle proche, placer l'oiseau plus haut pour laisser de l'espace
      birdY = 800 + Math.random() * 50; // Plus haut, entre 800 et 850
    } else {
      // Sinon, hauteur aléatoire dans la plage normale
      birdY = minBirdY + Math.random() * (maxBirdY - minBirdY);
    }
    
    birds.push({
      x: nextBirdX,
      y: birdY
    });
    
    nextBirdX += minBirdGap + Math.random() * (maxBirdGap - minBirdGap);
  }

  // Dessiner les oiseaux
  for (let i = birds.length - 1; i >= 0; i--) {
    const bird = birds[i];
    const birdScreenX = bird.x - birdOffset;
    
    // Dessiner l'image de l'oiseau si elle est chargée (sans fond blanc)
    if (birdImageProcessed && birdImage.complete && birdImage.naturalHeight !== 0) {
      ctx.drawImage(birdCanvas, birdScreenX, bird.y, birdWidth, birdHeight);
    } else if (birdImage.complete && birdImage.naturalHeight !== 0) {
      // Si l'image est chargée mais pas encore traitée, dessiner l'originale
      ctx.drawImage(birdImage, birdScreenX, bird.y, birdWidth, birdHeight);
    } else {
      // Fallback : dessiner un rectangle si l'image n'est pas encore chargée
      ctx.fillStyle = '#8B4513';
      ctx.fillRect(birdScreenX, bird.y, birdWidth, birdHeight);
    }
    
    // Supprimer les oiseaux qui sont sortis de l'écran
    if (birdScreenX < -birdWidth) {
      birds.splice(i, 1);
    }
  }

  // Si le jeu est en pause, ne pas mettre à jour la physique
  if (isPaused) {
    requestAnimationFrame(draw);
    return;
  }
  
  // Appliquer la gravité
  velocityY += gravity;
  y += velocityY;

  // Vérifier si le carré est en l'air
  const isInAir = y + size/2 < groundY - 1;
  
  // Détecter le début d'un nouveau saut et réinitialiser la rotation
  if (isInAir && wasOnGround) {
    rotationAngle = 0; // Réinitialiser la rotation au début de chaque saut
  }
  
  // Rotation pendant le saut (vers la droite) - un quart de tour seulement
  const targetRotation = Math.PI / 2; // 90 degrés (quart de tour)
  
  if (isInAir) {
    // Calculer la distance restante jusqu'au sol
    const distanceToGround = groundY - (y + size/2);
    
    // Estimer le temps restant avant l'atterrissage (en frames approximatives)
    // Utiliser la vélocité actuelle pour estimer le temps
    const timeToLand = Math.max(1, distanceToGround / Math.max(Math.abs(velocityY), 0.5));
    
    // Calculer la rotation restante à effectuer
    const remainingRotation = targetRotation - rotationAngle;
    
    if (remainingRotation > 0 && timeToLand > 0) {
      // Calculer la vitesse de rotation pour terminer juste avant l'atterrissage
      // On veut finir environ 1-2 frames avant l'atterrissage
      const framesBeforeLanding = Math.max(1, timeToLand - 2);
      const rotationSpeed = remainingRotation / framesBeforeLanding;
      
      // Limiter la vitesse minimale pour éviter des rotations trop lentes au début
      const minSpeed = 0.03;
      const maxSpeed = 0.03;
      const adjustedSpeed = Math.max(minSpeed, Math.min(maxSpeed, rotationSpeed));
      
      rotationAngle += adjustedSpeed;
      if (rotationAngle > targetRotation) {
        rotationAngle = targetRotation; // Limiter à π/2
      }
    }
  }
  // Le carré garde son angle de rotation à l'atterrissage
  
  // Mettre à jour l'état précédent
  wasOnGround = !isInAir;

  // Empêcher le carré de tomber sous le sol
  if (y + size/2 > groundY) {
    y = groundY - size/2;
    velocityY = 0;
  }

  // Mettre à jour le score basé sur la distance parcourue
  updateScore();

  // Vérifier les collisions avec les obstacles
  if (checkCollision()) {
    lives--;
    lastHitTime = Date.now();
    if (lives <= 0) {
      gameOver = true;
      // Sauvegarder le record si c'est un nouveau record
      saveRecord();
    }
  }

  // Afficher le score et le record en haut à droite avec contour pour meilleure visibilité
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'right';
  const scoreText = `Score: ${score}`;
  const recordText = `Record: ${record}`;
  const scoreX = canvas.width - 20;
  const scoreY = 40;
  const recordY = 70;
  
  // Contour noir pour le texte
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 4;
  ctx.strokeText(scoreText, scoreX, scoreY);
  ctx.strokeText(recordText, scoreX, recordY);
  
  // Texte blanc pour le score
  ctx.fillStyle = 'white';
  ctx.fillText(scoreText, scoreX, scoreY);
  
  // Texte doré pour le record
  ctx.fillStyle = '#ffd700';
  ctx.fillText(recordText, scoreX, recordY);
  
  // Afficher les vies en haut à gauche avec contour
  ctx.textAlign = 'left';
  const livesText = `Vies: ${lives}`;
  const livesX = 20;
  const livesY = 40;
  
  // Contour noir pour le texte
  ctx.strokeText(livesText, livesX, livesY);
  
  // Texte blanc
  ctx.fillText(livesText, livesX, livesY);
  
  // Mesurer la largeur du texte des vies pour centrer l'icône
  const livesTextWidth = ctx.measureText(livesText).width;
  
  // Icône de pause (2 petites lignes blanches) centrée sous les vies
  const pauseIconSize = 12; // Largeur de chaque ligne
  const pauseIconHeight = 35; // Hauteur des lignes
  const pauseIconGap = 6; // Espace entre les deux lignes
  const pauseIconTotalWidth = pauseIconSize * 2 + pauseIconGap; // Largeur totale de l'icône
  
  // Centrer l'icône sous le texte des vies
  const pauseIconX = livesX + (livesTextWidth / 2) - (pauseIconTotalWidth / 2);
  const pauseIconY = 80;
  
  ctx.fillStyle = 'white';
  // Première ligne (gauche)
  ctx.fillRect(pauseIconX, pauseIconY, pauseIconSize, pauseIconHeight);
  // Deuxième ligne (droite)
  ctx.fillRect(pauseIconX + pauseIconSize + pauseIconGap, pauseIconY, pauseIconSize, pauseIconHeight);
  
  // Zone cliquable (légèrement plus grande que l'icône)
  const pauseButtonX = pauseIconX - 5;
  const pauseButtonY = pauseIconY - 5;
  const pauseButtonWidth = pauseIconSize * 2 + pauseIconGap + 10;
  const pauseButtonHeight = pauseIconHeight + 10;

  // Effet d'invincibilité (clignotement)
  const currentTime = Date.now();
  const isInvincible = currentTime - lastHitTime < invincibilityTime;
  const shouldDraw = !isInvincible || Math.floor((currentTime - lastHitTime) / 100) % 2 === 0;

  // Carré plein (avec effet de clignotement si invincible)
  if (shouldDraw) {
    // Sauvegarder le contexte pour la rotation
    ctx.save();
    
    // Translater au centre du carré et appliquer la rotation
    ctx.translate(x, y);
    ctx.rotate(rotationAngle);
    
    // Corps (capsule)
    const bodyGradient = ctx.createLinearGradient(
      -size / 2,
      -size / 2,
      size / 2,
      size / 2
    );
    bodyGradient.addColorStop(0, '#444');
    bodyGradient.addColorStop(1, '#111');

    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.fillRect(-size/2, -size/2, size, size, 16);
    ctx.fill();
    
    // Restaurer le contexte
    ctx.restore();

  }

  requestAnimationFrame(draw);
}

// Écouter les touches
document.addEventListener('keydown', (event) => {
  // Si on est dans le menu principal, Espace ou Entrée commence le jeu
  if (inMainMenu) {
    if (event.code === 'Space' || event.code === 'Enter') {
      inMainMenu = false;
      gameOver = false;
      isPaused = false;
      pauseStartTime = 0;
      y = groundY - size/2;
      velocityY = 0;
      obstacles = [];
      birds = [];
      globalOffset = 0;
      groundOffset = 0;
      birdOffset = 0;
      nextObstacleX = canvas.width + 200;
      nextBirdX = canvas.width + 300;
      score = 0;
      lives = 2;
      lastHitTime = 0;
      scrollSpeed = 3;
      speedLevel = 0;
      farOffset.value = 0;
      midOffset.value = 0;
      nearOffset.value = 0;
      rotationAngle = 0;
      wasOnGround = true;
      menuOffset = 0;
      event.preventDefault();
    }
    return;
  }
  
  if (gameOver) {
    if (event.code === 'Space') {
      // Redémarrer directement le jeu sans passer par le menu
      inMainMenu = false;
      gameOver = false;
      isPaused = false;
      pauseStartTime = 0;
      y = groundY - size/2;
      velocityY = 0;
      obstacles = [];
      birds = [];
      globalOffset = 0;
      groundOffset = 0;
      birdOffset = 0;
      nextObstacleX = canvas.width + 200;
      nextBirdX = canvas.width + 300;
      score = 0;
      lives = 2;
      lastHitTime = 0;
      scrollSpeed = 3;
      speedLevel = 0;
      farOffset.value = 0;
      midOffset.value = 0;
      nearOffset.value = 0;
      rotationAngle = 0;
      wasOnGround = true;
      menuOffset = 0;
      event.preventDefault();
      // Ne pas appeler draw() ici car la boucle d'animation tourne déjà
    }
    return;
  }

  // Gérer la pause/reprise
  // Escape peut mettre en pause mais pas reprendre
  if (event.code === 'Escape' && !isPaused) {
    isPaused = true;
    pauseStartTime = Date.now(); // Enregistrer le temps de début de pause
    event.preventDefault();
    return;
  }
  // P peut mettre en pause mais pas reprendre
  if (event.code === 'KeyP' && !isPaused) {
    isPaused = true;
    pauseStartTime = Date.now(); // Enregistrer le temps de début de pause
    event.preventDefault();
    return;
  }
  // Espace peut reprendre si en pause
  if (event.code === 'Space' && isPaused) {
    isPaused = false;
    pauseStartTime = 0; // Réinitialiser le minuteur
    event.preventDefault();
    return;
  }

  // Sauter seulement si le jeu n'est pas en pause
  if (!isPaused && event.code === 'Space' && y + size/2 >= groundY - 1) {
    velocityY = jumpStrength;
    event.preventDefault();
  }
});

// Gérer les clics sur le bouton de pause et le bouton restart
canvas.addEventListener('click', (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  
  // Si on est dans le menu principal, cliquer n'importe où commence le jeu
  if (inMainMenu) {
    inMainMenu = false;
    gameOver = false;
    isPaused = false;
    pauseStartTime = 0;
    y = groundY - size/2;
    velocityY = 0;
    obstacles = [];
    birds = [];
    globalOffset = 0;
    groundOffset = 0;
    birdOffset = 0;
    nextObstacleX = canvas.width + 200;
    nextBirdX = canvas.width + 300;
    score = 0;
    lives = 2;
    lastHitTime = 0;
    scrollSpeed = 3;
    speedLevel = 0;
    farOffset.value = 0;
    midOffset.value = 0;
    nearOffset.value = 0;
    rotationAngle = 0;
    wasOnGround = true;
    menuOffset = 0;
    return;
  }
  
  // Si le jeu est en pause, vérifier le clic sur le bouton restart
  if (isPaused && !gameOver) {
    const restartButtonX = canvas.width / 2 - 120;
    const restartButtonY = canvas.height / 2 + 120;
    const restartButtonWidth = 240;
    const restartButtonHeight = 70;
    
    if (x >= restartButtonX && x <= restartButtonX + restartButtonWidth &&
        y >= restartButtonY && y <= restartButtonY + restartButtonHeight) {
      resetGame();
      return;
    }
  }
  
  if (gameOver) {
    // Si game over, cliquer redémarre directement le jeu
    inMainMenu = false;
    gameOver = false;
    isPaused = false;
    pauseStartTime = 0;
    y = groundY - size/2;
    velocityY = 0;
    obstacles = [];
    birds = [];
    globalOffset = 0;
    groundOffset = 0;
    birdOffset = 0;
    nextObstacleX = canvas.width + 200;
    nextBirdX = canvas.width + 300;
    score = 0;
    lives = 2;
    lastHitTime = 0;
    scrollSpeed = 3;
    speedLevel = 0;
    farOffset.value = 0;
    midOffset.value = 0;
    nearOffset.value = 0;
    rotationAngle = 0;
    wasOnGround = true;
    menuOffset = 0;
    return;
  }
  
  // Vérifier si le clic est sur le bouton de pause
  // Calculer la position centrée de l'icône (même logique que dans draw())
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'left';
  const livesText = `Vies: ${lives}`;
  const livesX = 20;
  const livesTextWidth = ctx.measureText(livesText).width;
  
  const pauseIconSize = 12;
  const pauseIconGap = 6;
  const pauseIconTotalWidth = pauseIconSize * 2 + pauseIconGap;
  const pauseIconX = livesX + (livesTextWidth / 2) - (pauseIconTotalWidth / 2);
  const pauseIconY = 80;
  const pauseIconHeight = 35;
  
  // Zone cliquable (légèrement plus grande que l'icône)
  const pauseButtonX = pauseIconX - 5;
  const pauseButtonY = pauseIconY - 5;
  const pauseButtonWidth = pauseIconTotalWidth + 10;
  const pauseButtonHeight = pauseIconHeight + 10;
  
  if (x >= pauseButtonX && x <= pauseButtonX + pauseButtonWidth &&
      y >= pauseButtonY && y <= pauseButtonY + pauseButtonHeight) {
    if (!isPaused) {
      isPaused = true;
      pauseStartTime = Date.now(); // Enregistrer le temps de début de pause
    } else {
      isPaused = false;
      pauseStartTime = 0; // Réinitialiser le minuteur
    }
  }
});

// Initialiser la position du carré et des obstacles
y = groundY - size/2;
nextObstacleX = canvas.width + 200;
draw();
