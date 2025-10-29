// Minimizing menu functionality
document.addEventListener('DOMContentLoaded', function() {
    const menuContainer = document.getElementById('rightMenu');
    const menuToggle = document.getElementById('menuToggle');
    const menuContent = document.getElementById('menuContent');
    
    // Initially show the menu
    let isMinimized = false;
    
    // Toggle menu visibility
    function toggleMenu() {
        if (isMinimized) {
            menuContent.style.display = 'block';
            menuToggle.innerHTML = '📄';
            menuContainer.style.width = '200px';
            isMinimized = false;
        } else {
            menuContent.style.display = 'none';
            menuToggle.innerHTML = '📄';
            menuContainer.style.width = '50px';
            isMinimized = true;
        }
    }
    
    // Add click event to toggle button
    menuToggle.addEventListener('click', toggleMenu);
    
    // Auto-minimize after 3 seconds
    setTimeout(function() {
        if (!isMinimized) {
            toggleMenu();
        }
    }, 3000);
});