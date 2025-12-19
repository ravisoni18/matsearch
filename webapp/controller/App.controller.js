sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Menu",
    "sap/m/MenuItem",
    "knmtapp/utils/AuthGuard"
], function (Controller, MessageBox, MessageToast, Menu, MenuItem, AuthGuard) {
    "use strict";

    return Controller.extend("knmtapp.controller.App", {
        onInit: function () {
            // Add route matched handler to check authentication
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.attachRouteMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function(oEvent) {
            var sRouteName = oEvent.getParameter("name");
            
            // Public routes that don't require authentication
            // Note: Since we're using centralized auth, the login/register routes
            // are in the auth app, not in this app
            var aPublicRoutes = [];
            
            // Check if route requires authentication
            if (aPublicRoutes.indexOf(sRouteName) === -1) {
                // Check if user is authenticated using AuthGuard
                if (!AuthGuard.isAuthenticated()) {
                    // Not authenticated - redirect to centralized auth app
                    console.log("User not authenticated, redirecting to auth app");
                    AuthGuard.redirectToLogin();
                }
            }

            this.getOwnerComponent().getModel("currentUser").setProperty("/zsystem", this.getSystem())

        },

        getSystem: function() {
            try {
                var cookies = JSON.parse(decodeURIComponent(document.cookie.split(";").find(element => element.trim().split("porky_auth").length > 1).split("porky_auth=")[1])).zsystem;
                return cookies;
            } catch (e) {
                return null;
            }
        },

        onAvatarPress: function(oEvent) {
            var oButton = oEvent.getSource();
            var that = this;

            // Create menu if not exists
            if (!this._oUserMenu) {
                this._oUserMenu = new Menu({
                    items: [
                        new MenuItem({
                            text: "User Info",
                            icon: "sap-icon://person-placeholder",
                            press: function() {
                                that.onShowUserInfo();
                            }
                        }),
                        new MenuItem({
                            text: "Logout",
                            icon: "sap-icon://log",
                            press: function() {
                                that.onSignOut();
                            }
                        })
                    ]
                });
            }

            this._oUserMenu.openBy(oButton);
        },

        onShowUserInfo: function() {
            // Get user data from AuthGuard
            var userData = AuthGuard.getCurrentUser();
            
            if (userData) {
                var sUserName = userData.displayName || "N/A";
                var sUserEmail = userData.email || "N/A";
                var sUserId = userData.uid || "N/A";
                var system = userData.zsystem || "N/A";

                var sMessage = "Display Name: " + sUserName + "\n" +
                              "Email: " + sUserEmail + "\n" +
                              "User ID: " + sUserId+ "\n"+
                              "System: "+system;

                MessageBox.information(sMessage, {
                    title: "User Information",
                    styleClass: "sapUiSizeCompact"
                });
            } else {
                MessageBox.error("Unable to retrieve user information");
            }
        },

        onSignOut: function() {
            var that = this;
            
            MessageBox.confirm(
                "Are you sure you want to sign out?",
                {
                    title: "Sign Out",
                    icon: MessageBox.Icon.QUESTION,
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.YES) {
                            // Use AuthGuard to logout
                            // This will clear cookie and redirect to auth app
                            AuthGuard.logout();
                            
                            MessageToast.show("Signing out...");
                        }
                    }
                }
            );
        }
    });
});