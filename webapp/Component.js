sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/ui/model/json/JSONModel",
    "knmtapp/utils/CookieManager",
    "knmtapp/utils/AuthGuard",
    "sap/ui/Device"
], function (UIComponent, ODataModel, JSONModel, CookieManager,AuthGuard,Device) {
    "use strict";

    return UIComponent.extend("knmtapp.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            
            // Create device model
            var oDeviceModel = new JSONModel(sap.ui.Device);
            oDeviceModel.setDefaultBindingMode("OneWay");
            this.setModel(oDeviceModel, "device");


            // Set device model
            this.setModel(new JSONModel(Device), "device");

            /**
             * AUTHENTICATION SETUP
             */
            var authConfig = {
                authAppUrl: "https://portal.porky.com/login",  // Your auth app URL
                cookieName: "porky_auth",
                sessionTimeout: 24 * 60 * 60 * 1000
            };

            var userData = AuthGuard.initialize(this, authConfig);

            if (userData) {
                // User authenticated
                console.log("User authenticated:", userData.email);
                this.setModel(new JSONModel(userData), "currentUser");
                this.getRouter().initialize();
            } else {
                // Not authenticated - will redirect to auth app
                console.log("User not authenticated, redirecting...");
            }
            
            // Create empty listData model BEFORE router initialization
            var oListDataModel = new JSONModel({
                items: {
                    data: [],
                    length: 0
                }
            });
            this.setModel(oListDataModel, "listData");
            
            // Initialize current user model
            var oCurrentUserModel = new JSONModel({
                uid: null,
                email: null,
                displayName: null,
                photoURL: null,
                isAuthenticated: false
            });
            this.setModel(oCurrentUserModel, "currentUser");
            
            // Check for authentication in cookie before setting up Firebase listener
            this._checkCookieAuth();
            
            // Set up Firebase auth state listener
            this._setupAuthListener();
            
            // Initialize router
            this.getRouter().initialize();



            
        },
        getAuthGuard: function() {
            // Return the AuthGuard singleton
            return sap.ui.require("knmtapp/utils/AuthGuard");
        },

        logout: function() {
            var AuthGuard = sap.ui.require("knmtapp/utils/AuthGuard");
            if (AuthGuard) {
                AuthGuard.logout();
            }
        },

        getCurrentUser: function() {
            var AuthGuard = sap.ui.require("knmtapp/utils/AuthGuard");
            if (AuthGuard) {
                return AuthGuard.getCurrentUser();
            }
            return null;
        },

        /**
         * Check for existing authentication in cookie
         */
        _checkCookieAuth: function() {
            var authData = CookieManager.getAuthFromCookie();
            if (authData) {
                console.log("Restoring authentication from cookie");
                var oCurrentUserModel = this.getModel("currentUser");
                oCurrentUserModel.setData({
                    uid: authData.uid,
                    email: authData.email,
                    displayName: authData.displayName,
                    photoURL: authData.photoURL,
                    isAuthenticated: true
                });
            }
        },

        _setupAuthListener: function() {
            var that = this;
            var oCurrentUserModel = this.getModel("currentUser");

            firebase.auth().onAuthStateChanged(function(user) {
                if (user) {
                    // User is signed in
                    var userData = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email,
                        photoURL: user.photoURL,
                        isAuthenticated: true
                    };
                    
                    // Update model
                    oCurrentUserModel.setData(userData);
                    
                    // Save to cookie
                    CookieManager.saveAuthToCookie(userData);
                    
                    console.log("User authenticated:", user.email);

                    var oRouter = that.getRouter();
                    var oHashChanger = sap.ui.core.routing.HashChanger.getInstance();
                    var sCurrentHash = oHashChanger.getHash();
                    
                    // Navigate to list if not already there
                    if (sCurrentHash === "" || sCurrentHash === "login" || sCurrentHash === "register") {
                        oRouter.navTo("list");
                    }
                } else {
                    // User is signed out
                    console.log("User signed out");
                    
                    // Clear cookie
                    CookieManager.clearAuthCookie();
                    
                    // Clear model
                    oCurrentUserModel.setData({
                        uid: null,
                        email: null,
                        displayName: null,
                        photoURL: null,
                        isAuthenticated: false
                    });
                    
                    // Navigate to login if not already there
                    var oRouter = that.getRouter();
                    var oHashChanger = sap.ui.core.routing.HashChanger.getInstance();
                    var sCurrentHash = oHashChanger.getHash();
                    
                    if (sCurrentHash !== "login" && sCurrentHash !== "register") {
                        oRouter.navTo("login");
                    }
                }
            });
        },

        /**
         * Check if user is authenticated
         * @returns {boolean} true if authenticated
         */
        isAuthenticated: function() {
            var oCurrentUserModel = this.getModel("currentUser");
            return oCurrentUserModel.getProperty("/isAuthenticated");
        },

        /**
         * Get current user
         * @returns {object} current user data
         */
        getCurrentUser: function() {
            var oCurrentUserModel = this.getModel("currentUser");
            return oCurrentUserModel.getData();
        },

        /**
         * Sign out current user
         */
        signOut: function() {
            var that = this;
            firebase.auth().signOut().then(function() {
                // Clear cookie on sign out
                CookieManager.clearAuthCookie();
                console.log("User signed out successfully");
            }).catch(function(error) {
                console.error("Sign out error:", error);
            });
        }
    });
});