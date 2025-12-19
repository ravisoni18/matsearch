sap.ui.define([], function() {
    "use strict";

    /**
     * AuthGuard - Singleton object for authentication
     */
    var AuthGuard = {

        _authConfig: {
            authAppUrl: "https://portal.porky.com/login",
            cookieName: "porky_auth",
            sessionTimeout: 24 * 60 * 60 * 1000*14
        },

        /**
         * Initialize auth guard
         */
        initialize: function(component, config) {
            if (config) {
                Object.assign(this._authConfig, config);
            }

            // Check URL parameters first (redirect from auth app)
            var userData = this.checkAuthFromUrl();
            if (userData) {
                return userData;
            }

            // Check existing authentication
            userData = this.isAuthenticated();
            
            if (!userData) {
                // Not authenticated - redirect to login
                this.redirectToLogin();
                return null;
            }
            
            return userData;
        },

        /**
         * Check if user is authenticated from cookie
         */
        isAuthenticated: function() {
            var authCookie = this._getCookie(this._authConfig.cookieName);
            if (!authCookie) {
                return null;
            }

            try {
                var authData = JSON.parse(decodeURIComponent(authCookie));
                
                if (authData.timestamp) {
                    var now = new Date().getTime();
                    if (now - authData.timestamp > this._authConfig.sessionTimeout) {
                        this.clearAuth();
                        return null;
                    }
                }
                
                return authData;
            } catch (e) {
                console.error("Error parsing auth cookie:", e);
                return null;
            }
        },

        /**
         * Check authentication from URL parameters
         */
        checkAuthFromUrl: function() {
            var urlParams = new URLSearchParams(window.location.search);
            var authToken = urlParams.get("auth_token");
            var authEmail = urlParams.get("auth_email");
            var authName = urlParams.get("auth_name");
            var zsystem = urlParams.get("zsystem");

            if (authToken && authEmail) {
                var userData = {
                    uid: authToken,
                    email: authEmail,
                    displayName: authName || authEmail,
                    isAuthenticated: true,
                    zsystem: zsystem,
                    timestamp: new Date().getTime()
                };

                this._saveAuthToCookie(userData);
                this._cleanUrl();

                return userData;
            }

            return null;
        },

        /**
         * Redirect to auth app
         * @param {string} returnUrl - Optional URL to return to after auth (defaults to current URL)
         */
        redirectToLogin: function(returnUrl) {
            // If no returnUrl provided, use current URL
            var targetUrl = returnUrl || window.location.href;
            
            // Clean the URL (remove any auth parameters)
            targetUrl = this._cleanUrlString(targetUrl);
            
            // Build auth URL with return parameter
            var authUrl = this._authConfig.authAppUrl + "?returnUrl=" + encodeURIComponent(targetUrl)
+"&h1="+ encodeURIComponent("Porky")
+"&h2="+ encodeURIComponent("Welcome to Albertsons K&B ↔ Porky Item Cross Reference Online Access")
+"&h3="+ encodeURIComponent("Welcome Back")
+"&alternateauth="+encodeURIComponent("apple,google,microsoft")
+"&showsignup="+ encodeURIComponent("true")
+"&branding="+ encodeURIComponent("porky");


            console.log("[AuthGuard] Redirecting to auth app:", authUrl);
            
            // Redirect
            window.location.href = authUrl;
        },

        /**
         * Logout - clear auth and redirect to auth app
         */
        logout: function() {
            console.log("[AuthGuard] Logging out");
    
    // Clear authentication cookie locally
    this.clearAuth();
    
    // Get current URL (before redirecting)
    var currentUrl = window.location.href;
    
    // Clean any auth parameters from current URL
    currentUrl = this._cleanUrlString(currentUrl);
    
    // Build auth app URL with BOTH returnUrl AND logout=true
    var authUrl = this._authConfig.authAppUrl + 
                  "?logout=true" + 
                  "&returnUrl=" + encodeURIComponent(currentUrl)
                  +"&h1="+ encodeURIComponent("Porky")
                  +"&h2="+ encodeURIComponent("Welcome to Albertsons K&B ↔ Porky Item Cross Reference Online Access")
                  +"&h3="+ encodeURIComponent("Welcome Back")
                  +"&alternateauth="+encodeURIComponent("apple,google,microsoft")
                  +"&showsignup="+ encodeURIComponent("true")
                  +"&branding="+ encodeURIComponent("porky");;
    
    console.log("[AuthGuard] Redirecting to auth app for logout:", authUrl);
    
    // Redirect to auth app with logout flag
    window.location.href = authUrl;
        },

        /**
         * Clear authentication
         */
        clearAuth: function() {
            this._deleteCookie(this._authConfig.cookieName);
            console.log("[AuthGuard] Authentication cleared");
        },

        /**
         * Get current user
         */
        getCurrentUser: function() {
            return this.isAuthenticated();
        },

        /**
         * Require authentication - redirect if not authenticated
         * @returns {boolean} true if authenticated, false if redirecting
         */
        requireAuth: function() {
            var userData = this.isAuthenticated();
            
            if (!userData) {
                this.redirectToLogin();
                return false;
            }
            
            return true;
        },

        // Private methods

        /**
         * Save authentication to cookie
         * @private
         */
        _saveAuthToCookie: function(userData) {
            var cookieData = {
                uid: userData.uid,
                email: userData.email,
                displayName: userData.displayName,
                photoURL: userData.photoURL,
                isAuthenticated: true,
                zsystem: userData.zsystem,
                timestamp: new Date().getTime()
            };

            var cookieValue = encodeURIComponent(JSON.stringify(cookieData));
            var expiryDate = new Date();
            expiryDate.setTime(expiryDate.getTime() + this._authConfig.sessionTimeout);

            var cookieString = this._authConfig.cookieName + "=" + cookieValue + 
                "; expires=" + expiryDate.toUTCString() + 
                "; path=/; SameSite=Lax";
            
            // Add Secure flag for HTTPS
            if (window.location.protocol === "https:") {
                cookieString += "; Secure";
            }

            document.cookie = cookieString;
            
            console.log("[AuthGuard] Auth saved to cookie for:", userData.email);
        },

        /**
         * Get cookie by name
         * @private
         */
        _getCookie: function(name) {
            var nameEQ = name + "=";
            var cookies = document.cookie.split(';');
            
            for (var i = 0; i < cookies.length; i++) {
                var cookie = cookies[i].trim();
                if (cookie.indexOf(nameEQ) === 0) {
                    return cookie.substring(nameEQ.length);
                }
            }
            return null;
        },

        /**
         * Delete cookie by name
         * @private
         */
        _deleteCookie: function(name) {
            document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        },

        /**
         * Clean auth parameters from current URL
         * @private
         */
        _cleanUrl: function() {
            var cleanUrl = this._cleanUrlString(window.location.href);
            window.history.replaceState({}, document.title, cleanUrl);
            console.log("[AuthGuard] URL cleaned");
        },

        /**
         * Clean auth parameters from a URL string
         * @private
         */
        _cleanUrlString: function(url) {
            try {
                var urlObj = new URL(url);
                urlObj.searchParams.delete("auth_token");
                urlObj.searchParams.delete("auth_email");
                urlObj.searchParams.delete("auth_name");
                urlObj.searchParams.delete("zsystem");

                
                return urlObj.toString();
            } catch (e) {
                console.error("[AuthGuard] Error cleaning URL:", e);
                return url;
            }
        }
    };

    return AuthGuard;
});