# 🎮 Brick Breaker 3D  

A modern, responsive remake of the classic **Brick Breaker** game with **3D animated backgrounds**, touch & mouse support, and adaptive layouts for desktop, tablet, and mobile.  

## ✨ Features  

- 🧱 **Dynamic Levels**  
  - Bricks increase per level.  
  - Difficulty scales with faster ball speed.  
  - Sliding brick window keeps gameplay engaging on smaller screens.  

- 🎨 **Visuals & Styling**  
  - 3D animated starfield background (`background.js`).  
  - Smooth neon-themed UI with retro pixel font.  
  - Responsive rectangular canvas (taller on mobile, 4:3 ratio on desktop).  
  - Level-complete animations and game-over modal.  

- 🎮 **Controls**  
  - **Desktop:** Move paddle with mouse.  
  - **Mobile / Touch Devices:** Drag paddle with your finger.  
  - Paddle size auto-adjusts to device type (easier on touch).  

- 💾 **Save System**  
  - Current **score** and **level** saved in `localStorage`.  
  - Resume from where you left off.  

## 📂 Project Structure  
├── index.html # Main HTML structure
├── style.css # Styling for game, UI, and modals
├── script.js # Game logic, rendering, input handling
├── background.js # Animated 3D starfield background


## 🚀 How to Run  

1. Clone/download the repo.  
2. Open `index.html` in your browser.  
3. Press **Start Game** to begin!  

> Works seamlessly on **desktop**, **phones**, and **tablets**.  

## 🎮 Gameplay  

- Break all the bricks to advance levels.  
- Ball speed increases with level progression.  
- Lose a life if the ball falls past the paddle.  
- Game ends when you run out of lives. 
