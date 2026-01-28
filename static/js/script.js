document.addEventListener('DOMContentLoaded', function() {
    // Smooth scrolling for navigation links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Add active class to navigation items when scrolling
    window.addEventListener('scroll', function() {
        let scrollPosition = window.scrollY;

        document.querySelectorAll('section').forEach(section => {
            if (section.offsetTop <= scrollPosition + 150) {
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').substring(1) === section.id) {
                        link.classList.add('active');
                    }
                });
            }
        });
    });

    // Mobile menu functionality
    const navbarCollapse = document.getElementById('navbarNav');
    const navbarToggler = document.querySelector('.navbar-toggler');
    
    if (navbarCollapse) {
        // Close menu when clicking a nav link
        navbarCollapse.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth < 992) {
                    const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
                    if (bsCollapse) {
                        bsCollapse.hide();
                    }
                }
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (window.innerWidth < 992 && navbarCollapse.classList.contains('show')) {
                // Check if click is outside the menu and toggler
                const isClickInsideMenu = navbarCollapse.contains(e.target);
                const isClickOnToggler = navbarToggler && navbarToggler.contains(e.target);
                
                if (!isClickInsideMenu && !isClickOnToggler) {
                    const bsCollapse = bootstrap.Collapse.getInstance(navbarCollapse);
                    if (bsCollapse) {
                        bsCollapse.hide();
                    }
                }
            }
        });
    }
});
