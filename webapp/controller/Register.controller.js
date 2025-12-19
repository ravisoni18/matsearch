sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator",
    "knmtapp/utils/CookieManager"
], function (Controller, JSONModel, MessageBox, MessageToast, BusyIndicator, CookieManager) {
    "use strict";

    return Controller.extend("knmtapp.controller.Register", {
        onInit: function () {
            // Initialize register model
            var oRegisterModel = new JSONModel({
                name: "",
                email: "",
                password: "",
                confirmPassword: "",
                nameState: "None",
                nameStateText: "",
                emailState: "None",
                emailStateText: "",
                passwordState: "None",
                passwordStateText: "",
                confirmPasswordState: "None",
                confirmPasswordStateText: ""
            });
            this.getView().setModel(oRegisterModel, "register");
        },

        onRegister: function() {
            var oRegisterModel = this.getView().getModel("register");
            var sName = oRegisterModel.getProperty("/name");
            var sEmail = oRegisterModel.getProperty("/email");
            var sPassword = oRegisterModel.getProperty("/password");
            var sConfirmPassword = oRegisterModel.getProperty("/confirmPassword");
            
            // Reset validation states
            oRegisterModel.setProperty("/nameState", "None");
            oRegisterModel.setProperty("/nameStateText", "");
            oRegisterModel.setProperty("/emailState", "None");
            oRegisterModel.setProperty("/emailStateText", "");
            oRegisterModel.setProperty("/passwordState", "None");
            oRegisterModel.setProperty("/passwordStateText", "");
            oRegisterModel.setProperty("/confirmPasswordState", "None");
            oRegisterModel.setProperty("/confirmPasswordStateText", "");
            
            // Validation
            var bValid = true;
            
            if (!sName || !sName.trim()) {
                oRegisterModel.setProperty("/nameState", "Error");
                oRegisterModel.setProperty("/nameStateText", "Name is required");
                bValid = false;
            }
            
            if (!sEmail || !sEmail.trim()) {
                oRegisterModel.setProperty("/emailState", "Error");
                oRegisterModel.setProperty("/emailStateText", "Email is required");
                bValid = false;
            } else if (!this._validateEmail(sEmail)) {
                oRegisterModel.setProperty("/emailState", "Error");
                oRegisterModel.setProperty("/emailStateText", "Invalid email format");
                bValid = false;
            }
            
            if (!sPassword || !sPassword.trim()) {
                oRegisterModel.setProperty("/passwordState", "Error");
                oRegisterModel.setProperty("/passwordStateText", "Password is required");
                bValid = false;
            } else if (sPassword.length < 6) {
                oRegisterModel.setProperty("/passwordState", "Error");
                oRegisterModel.setProperty("/passwordStateText", "Password must be at least 6 characters");
                bValid = false;
            }
            
            if (!sConfirmPassword || !sConfirmPassword.trim()) {
                oRegisterModel.setProperty("/confirmPasswordState", "Error");
                oRegisterModel.setProperty("/confirmPasswordStateText", "Please confirm your password");
                bValid = false;
            } else if (sPassword !== sConfirmPassword) {
                oRegisterModel.setProperty("/confirmPasswordState", "Error");
                oRegisterModel.setProperty("/confirmPasswordStateText", "Passwords do not match");
                bValid = false;
            }
            
            if (!bValid) {
                return;
            }
            
            // Create user with Firebase
            var that = this;
            BusyIndicator.show(0);
            
            firebase.auth().createUserWithEmailAndPassword(sEmail, sPassword)
                .then(function(userCredential) {
                    var user = userCredential.user;
                    
                    // Update user profile with display name
                    return user.updateProfile({
                        displayName: sName
                    }).then(function() {
                        return user;
                    });
                })
                .then(function(user) {
                    BusyIndicator.hide();
                    
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
                    
                    MessageBox.success("Account created successfully!", {
                        onClose: function() {
                            that.getOwnerComponent().getRouter().navTo("list");
                        }
                    });
                })
                .catch(function(error) {
                    BusyIndicator.hide();
                    var errorMessage = that._getFirebaseErrorMessage(error.code);
                    MessageBox.error(errorMessage);
                    
                    if (error.code === "auth/email-already-in-use") {
                        oRegisterModel.setProperty("/emailState", "Error");
                        oRegisterModel.setProperty("/emailStateText", "Email already in use");
                    }
                });
        },

        onNavToLogin: function() {
            this.getOwnerComponent().getRouter().navTo("login");
        },

        onNavBack: function() {
            this.getOwnerComponent().getRouter().navTo("login");
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
                "auth/too-many-requests": "Too many failed attempts. Please try again later."
            };
            
            return errorMessages[errorCode] || "Registration error: " + errorCode;
        }
    });
});