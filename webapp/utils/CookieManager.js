sap.ui.define([], function () {
    "use strict";

    return {
        /**
         * Set a cookie with specified name, value, and expiration days
         * @param {string} name - Cookie name
         * @param {string} value - Cookie value
         * @param {number} days - Number of days until expiration
         */
        setCookie: function(name, value, days) {
            var expires = "";
            if (days) {
                var date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
                expires = "; expires=" + date.toUTCString();
            }
            // Set cookie with secure flags
            document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Strict";
        },

        /**
         * Get cookie value by name
         * @param {string} name - Cookie name
         * @returns {string|null} Cookie value or null if not found
         */
        getCookie: function(name) {
            var nameEQ = name + "=";
            var ca = document.cookie.split(';');
            for(var i = 0; i < ca.length; i++) {
                var c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
            }
            return null;
        },

        /**
         * Delete a cookie by name
         * @param {string} name - Cookie name
         */
        deleteCookie: function(name) {
            document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        },

        /**
         * Save authentication data to cookie
         * @param {object} userData - User data object containing uid, email, displayName, photoURL
         */
        saveAuthToCookie: function(userData) {
            if (userData && userData.uid) {
                var authData = {
                    uid: userData.uid,
                    email: userData.email,
                    displayName: userData.displayName,
                    photoURL: userData.photoURL,
                    timestamp: new Date().getTime()
                };
                // Store as JSON string, expires in 7 days
                this.setCookie("knmt_auth", JSON.stringify(authData), 7);
                console.log("Authentication data saved to cookie");
            }
        },

        /**
         * Get authentication data from cookie
         * @returns {object|null} User data object or null if not found/expired
         */
        getAuthFromCookie: function() {
            var authCookie = this.getCookie("knmt_auth");
            if (authCookie) {
                try {
                    var authData = JSON.parse(authCookie);
                    
                    // Check if cookie is not older than 7 days
                    var currentTime = new Date().getTime();
                    var cookieAge = currentTime - authData.timestamp;
                    var maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
                    
                    if (cookieAge < maxAge) {
                        console.log("Valid authentication data found in cookie");
                        return authData;
                    } else {
                        console.log("Authentication cookie expired");
                        this.deleteCookie("knmt_auth");
                        return null;
                    }
                } catch(e) {
                    console.error("Error parsing auth cookie:", e);
                    this.deleteCookie("knmt_auth");
                    return null;
                }
            }
            return null;
        },

        /**
         * Clear authentication cookie
         */
        clearAuthCookie: function() {
            this.deleteCookie("knmt_auth");
            console.log("Authentication cookie cleared");
        }
    };
});