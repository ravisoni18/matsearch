sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator",
    "knmtapp/utils/CookieManager"
], function (Controller, JSONModel, MessageBox, MessageToast, BusyIndicator, CookieManager) {
    "use strict";

    return Controller.extend("knmtapp.controller.Login", {
        onInit: function () {
            // Initialize login model
            var oLoginModel = new JSONModel({
                email: "",
                password: "",
                emailState: "None",
                emailStateText: "",
                passwordState: "None",
                passwordStateText: ""
            });
            this.getView().setModel(oLoginModel, "login");

            // Check if user is already logged in from cookie
            this._checkAuthState();
              var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("login").attachPatternMatched(this._onObjectMatched, this);
        },
        _onObjectMatched: function () {
            // Clear login fields on route match
            var oLoginModel = this.getView().getModel("login");
            oLoginModel.setProperty("/email", "");
            oLoginModel.setProperty("/password", "");
            oLoginModel.setProperty("/emailState", "None");
            oLoginModel.setProperty("/emailStateText", "");
            oLoginModel.setProperty("/passwordState", "None");
            oLoginModel.setProperty("/passwordStateText", "");
            this.getOwnerComponent().getModel( "currentUser").setProperty("/isAuthenticated", false)    ;
        },

        _checkAuthState: function() {
            var that = this;
            
            // First check cookie
            var authData = CookieManager.getAuthFromCookie();
            if (authData) {
                console.log("User already authenticated from cookie, navigating to list");
                // Small delay to ensure Firebase is initialized
                setTimeout(function() {
                    that._navigateToList();
                }, 100);
                return;
            }
            
            // Then check Firebase Auth state
            var auth = firebase.auth();
            auth.onAuthStateChanged(function(user) {
                if (user) {
                    console.log("User already logged in from Firebase:", user.email);
                    that._navigateToList();
                }
            });
        },

        onLogin: function() {
            var oLoginModel = this.getView().getModel("login");
            var sEmail = oLoginModel.getProperty("/email");
            var sPassword = oLoginModel.getProperty("/password");
            
            // Reset validation states
            oLoginModel.setProperty("/emailState", "None");
            oLoginModel.setProperty("/emailStateText", "");
            oLoginModel.setProperty("/passwordState", "None");
            oLoginModel.setProperty("/passwordStateText", "");
            
            // Validation
            var bValid = true;
            
            if (!sEmail || !sEmail.trim()) {
                oLoginModel.setProperty("/emailState", "Error");
                oLoginModel.setProperty("/emailStateText", "Email is required");
                sap.m.MessageBox.error("Email is required");
                bValid = false;
            } else if (!this._validateEmail(sEmail)) {
                oLoginModel.setProperty("/emailState", "Error");
                oLoginModel.setProperty("/emailStateText", "Invalid email format");
                sap.m.MessageBox.error("Invalid email format");
                bValid = false;
            }
            
            if (!sPassword || !sPassword.trim()) {
                oLoginModel.setProperty("/passwordState", "Error");
                oLoginModel.setProperty("/passwordStateText", "Password is required");
                  sap.m.MessageBox.error("Password is required");
                bValid = false;
            }
            
            if (!bValid) {
                return;
            }
            
            // Sign in with Firebase
            var that = this;
            BusyIndicator.show(0);
            
            firebase.auth().signInWithEmailAndPassword(sEmail, sPassword)
                .then(function(userCredential) {
                    BusyIndicator.hide();
                    var user = userCredential.user;
                    
                    var userData = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email,
                        photoURL: user.photoURL,
                        isAuthenticated: true
                    };
                    
                    // Store user info in component
                    that.getOwnerComponent().setModel(new JSONModel(userData), "currentUser");
                    
                    // Save to cookie
                    CookieManager.saveAuthToCookie(userData);
                    
                    MessageToast.show("Login successful!");
                    that._navigateToList();
                })
                .catch(function(error) {
                    BusyIndicator.hide();
                    var errorMessage = that._getFirebaseErrorMessage(error.code);
                    MessageBox.error(errorMessage);
                    
                    oLoginModel.setProperty("/emailState", "Error");
                    oLoginModel.setProperty("/passwordState", "Error");
                });
        },

        onGoogleSignIn: function() {
            var that = this;
            BusyIndicator.show(0);
            
            var provider = new firebase.auth.GoogleAuthProvider();
            
            firebase.auth().signInWithPopup(provider)
                .then(function(result) {
                    BusyIndicator.hide();
                    var user = result.user;
                    
                    var userData = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email,
                        photoURL: user.photoURL,
                        isAuthenticated: true
                    };
                    
                    // Store user info in component
                    that.getOwnerComponent().setModel(new JSONModel(userData), "currentUser");
                    
                    // Save to cookie
                    CookieManager.saveAuthToCookie(userData);
                    
                    MessageToast.show("Login successful with Google!");
                    that._navigateToList();
                })
                .catch(function(error) {
                    BusyIndicator.hide();
                    
                    if (error.code !== 'auth/popup-closed-by-user') {
                        var errorMessage = that._getFirebaseErrorMessage(error.code);
                        MessageBox.error(errorMessage);
                    }
                });
        },

        onMicrosoftSignIn: function() {
            var that = this;
            BusyIndicator.show(0);
            
            var provider = new firebase.auth.OAuthProvider('microsoft.com');
            provider.addScope('mail.read');
            provider.addScope('User.Read');
            
            firebase.auth().signInWithPopup(provider)
                .then(function(result) {
                    BusyIndicator.hide();
                    var user = result.user;
                    
                    var userData = {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName || user.email,
                        photoURL: user.photoURL,
                        isAuthenticated: true
                    };
                    
                    // Store user info in component
                    that.getOwnerComponent().setModel(new JSONModel(userData), "currentUser");
                    
                    // Save to cookie
                    CookieManager.saveAuthToCookie(userData);
                    
                    MessageToast.show("Login successful with Microsoft!");
                    that._navigateToList();
                })
                .catch(function(error) {
                    BusyIndicator.hide();
                    
                    if (error.code !== 'auth/popup-closed-by-user') {
                        var errorMessage = that._getFirebaseErrorMessage(error.code);
                        MessageBox.error(errorMessage);
                    }
                });
        },

        onRegister: function() {
            this.getOwnerComponent().getRouter().navTo("register");
        },

        onForgotPassword: function() {
            var oLoginModel = this.getView().getModel("login");
            var sEmail = oLoginModel.getProperty("/email");
            var that = this;
            
            MessageBox.confirm(
                sEmail ? 
                    "Send password reset email to " + sEmail + "?" : 
                    "Please enter your email address first",
                {
                    title: "Reset Password",
                    actions: sEmail ? [MessageBox.Action.OK, MessageBox.Action.CANCEL] : [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.OK && sEmail) {
                            BusyIndicator.show(0);
                            
                            firebase.auth().sendPasswordResetEmail(sEmail)
                                .then(function() {
                                    BusyIndicator.hide();
                                    MessageBox.success("Password reset email sent! Please check your inbox.");
                                })
                                .catch(function(error) {
                                    BusyIndicator.hide();
                                    var errorMessage = that._getFirebaseErrorMessage(error.code);
                                    MessageBox.error(errorMessage);
                                });
                        }
                    }
                }
            );
        },

        _navigateToList: function() {
            var that = this;
            setTimeout(function() {
                var oRouter = that.getOwnerComponent().getRouter();
                oRouter.navTo("list");
            }, 100);
        },

        _validateEmail: function(email) {
            var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        },

        _getFirebaseErrorMessage: function(errorCode) {
            var errorMessages = {
                "auth/invalid-email": "The email address is invalid.",
                "auth/user-disabled": "This user account has been disabled.",
                "auth/user-not-found": "No user found with this email address.",
                "auth/wrong-password": "Incorrect password.",
                "auth/email-already-in-use": "This email address is already in use.",
                "auth/weak-password": "Password should be at least 6 characters.",
                "auth/network-request-failed": "Network error. Please check your connection.",
                "auth/too-many-requests": "Too many failed attempts. Please try again later.",
                "auth/invalid-credential": "Invalid email or password.",
                "auth/popup-blocked": "Sign-in popup was blocked. Please allow popups for this site.",
                "auth/cancelled-popup-request": "Only one popup request is allowed at a time.",
                "auth/account-exists-with-different-credential": "An account already exists with the same email but different sign-in credentials."
            };
            
            return errorMessages[errorCode] || "Authentication error: " + errorCode;
        }
    });
});