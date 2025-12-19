sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox", 
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, History, JSONModel, MessageBox, MessageToast, BusyIndicator, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("knmtapp.controller.Detail", {
        
        // ==================== HELPER FUNCTIONS ====================
        
        _getRequestHeaders: function() {
            // Detect environment based on URL
            var sCurrentUrl = window.location.href.toLowerCase();
            var sSysId = "DE2"; // Default
            
            if (sCurrentUrl.includes("de2") || sCurrentUrl.includes("DE2")) {
                sSysId = "DE2";
            } else if (sCurrentUrl.includes("qa2") || sCurrentUrl.includes("QA2")) {
                sSysId = "QA2";
            }

            if( this.getSystem().toUpperCase() === "DE2"){
                sSysId = 'DE2';
            }else   if( this.getSystem().toUpperCase() === "QA2"){
                sSysId = 'QA2';
            }
            else   if( this.getSystem().toUpperCase() === "PRD" ||
            !this.getSystem() || this.getSystem().toUpperCase().trim() === ""){
                sSysId = 'PRD';
            }
            
            return {
                'X-PORKY-SYSID': sSysId,
                'X-PORKY-AUTH': 'cm1lbGxveTpsdWNreW1l',
                'X-PORKY-APPID': 'PO',
                'X-PORKY-APIKEY': '6bb0b04a-0466-490e-a8a5-53278b3df025',
                'Authorization': 'Basic cm1lbGxveTpsdWNreW1l',
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            };
        },

		getSystem: function() {
            try {
                var cookies = JSON.parse(decodeURIComponent(document.cookie.split(";").find(element => element.trim().split("porky_auth").length > 1).split("porky_auth=")[1])).zsystem;
                return cookies;
            } catch (e) {
                return null;
            }
		},
        _makeRequest: function(url, options = {}) {
            const defaultOptions = {
                headers: this._getRequestHeaders(),
                credentials: 'include'
            };

            // Merge options
            const requestOptions = {
                ...defaultOptions,
                ...options,
                headers: {
                    ...defaultOptions.headers,
                    ...(options.headers || {})
                }
            };

            return fetch(url, requestOptions);
        },

        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("detail").attachPatternMatched(this._onObjectMatched, this);
            
            // Initialize value help dialogs as null
            this._oLocationDialog = null;
            this._oDepartmentDialog = null;
            this._oMaterialUsageDialog = null;
            
            // Initialize cache for auto-suggest
            this._aLocationCache = null;
            this._aDepartmentCache = null;
            this._aMaterialUsageCache = null;

                this._aTransactionTypeCache = null;  // ADD THIS LINE
             this._oTransactionTypeDialog = null;  // ADD THIS LINE

        },

        _onObjectMatched: function (oEvent) {
            var sKunnr = oEvent.getParameter("arguments").kunnr;
            var sVkorg = oEvent.getParameter("arguments").vkorg;
            var sKdmat = oEvent.getParameter("arguments").kdmat;
            
            this._loadDetailData(sKunnr, sVkorg, sKdmat);
        },

     _loadDetailData: function(sKunnr, sVkorg, sKdmat) {
            var that = this;
            
            var oComponent = this.getOwnerComponent();
            var oListModel = oComponent.getModel("listData");
            
            // Check if listData model exists and has data
            if (!oListModel || !oListModel.getProperty("/items/data") || oListModel.getProperty("/items/data").length === 0) {
                console.log("List data not available, fetching from server...");
                // If no data in model, fetch from server
                this._fetchDetailDataFromServer(sKunnr, sVkorg, sKdmat);
                return;
            }
            
            var aItems = oListModel.getProperty("/items/data");
            
            // Try to find item in existing data
            var oItem = aItems.find(function(item) {
                return item.kunnr === sKunnr && 
                       item.vkorg === sVkorg && 
                       item.kdmat === sKdmat;
            });
            
            if (oItem) {
                console.log("Item found in listData model");
                this._displayDetailData(oItem, sKunnr, sVkorg);
            } else {
                console.log("Item not found in listData, fetching from server...");
                // Item not found in cache, fetch from server
                this._fetchDetailDataFromServer(sKunnr, sVkorg, sKdmat);
            }
        },

         _fetchDetailDataFromServer: function(sKunnr, sVkorg, sKdmat) {
            var that = this;
            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZCSD_ZKNMTRequest";
            
            BusyIndicator.show(0);
            
            this._makeRequest(sUrl, {
                method: 'GET'
            })
                .then(function(response) {
                    return response.json();
                })
                .then(function(oData) {
                    BusyIndicator.hide();
                    
                    var aItems = [];
                    
                    // Parse the response data
                    if (oData && oData.content && Array.isArray(oData.content) && oData.content[0]) {
                        var data = JSON.parse(oData.content[0].text);
                        if (data && Array.isArray(data.data)) {
                            aItems = data.data;
                        } else if (Array.isArray(data)) {
                            aItems = data;
                        }
                    } else if (oData.d && oData.d.results) {
                        aItems = oData.d.results;
                    } else if (oData.value) {
                        aItems = oData.value;
                    } else if (Array.isArray(oData)) {
                        aItems = oData;
                    } else if (oData.data && Array.isArray(oData.data)) {
                        aItems = oData.data;
                    }
                    
                    console.log("Fetched items from server:", aItems.length);
                    
                    // Update the component's listData model with fresh data
                    var oComponent = that.getOwnerComponent();
                    var oListModel = oComponent.getModel("listData");
                    if (oListModel) {
                        oListModel.setProperty("/items/data", aItems);
                        oListModel.setProperty("/items/length", aItems.length);
                    }
                    
                    // Find the specific item
                    var oItem = aItems.find(function(item) {
                        return item.kunnr === sKunnr && 
                               item.vkorg === sVkorg && 
                               item.kdmat === sKdmat;
                    });
                    
                    if (oItem) {
                        console.log("Item found after server fetch");
                        that._displayDetailData(oItem, sKunnr, sVkorg);
                    } else {
                        BusyIndicator.hide();
                        MessageBox.error("Record not found. Customer: " + sKunnr + ", Material: " + sKdmat, {
                            onClose: function() {
                                that._navBack();
                            }
                        });
                    }
                })
                .catch(function(error) {
                    BusyIndicator.hide();
                    console.error("Error fetching detail data:", error);
                    MessageBox.error("Error loading data: " + error.message, {
                        onClose: function() {
                            that._navBack();
                        }
                    });
                });
        },

           _displayDetailData: function(oItem, sKunnr, sVkorg) {
            var oDetailData = Object.assign({}, oItem, {
                editMode: false,
                originalData: Object.assign({}, oItem)
            });
            
            if (!oDetailData.vtweg) {
                oDetailData.vtweg = "10";
            }
            
            var oDetailModel = new JSONModel(oDetailData);
            this.getView().setModel(oDetailModel, "detailData");
            
            // Preload data for auto-suggest
            this._preloadLocationData(sKunnr, sVkorg);
            this._preloadDepartmentData(sKunnr, sVkorg);
            this._preloadMaterialUsageData();
            this._preloadTransactionTypeData();
        },

        formatStatus: function(status) {
            if (status === 'P') return 'Warning';
            if (status === 'A') return 'Success';
            if (status === 'R') return 'Error';
            return 'None';
        },

        onToggleEdit: function() {
            var oModel = this.getView().getModel("detailData");
            var bEditMode = oModel.getProperty("/editMode");
            
            if (bEditMode) {
                this.onSave();
            } else {
                oModel.setProperty("/editMode", true);
                MessageToast.show("Edit mode enabled");
            }
        },

        onSave: function() {
            var oModel = this.getView().getModel("detailData");
            var oData = oModel.getData();
            
            if (!oData.kunnr || !oData.vkorg || !oData.kdmat) {
                MessageBox.error("Customer Number, Sales Organization, and Material Number are required");
                return;
            }
            
            var that = this;
            MessageBox.confirm(
                "Do you want to save the changes?",
                {
                    title: "Confirm Save",
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            that._saveData(oData);
                        }
                    }
                }
            );
        },

        _saveData: function(oData) {
            var that = this;
            
            var oUpdateData = {
                kunnr: oData.kunnr,
                vkorg: oData.vkorg,
                vtweg: oData.vtweg || "10",
                kdmat: oData.kdmat,
                zzloc: oData.zzloc || "",
                zzdepartment: oData.zzdepartment || "",
                zzmaterialusage: oData.zzmaterialusage || "",
                zzean11: oData.zzean11 || "",
                zzpack: oData.zzpack ? oData.zzpack.toString() : "0",
                zzuom: oData.zzuom || "",
                zzpack_whse: oData.zzpack_whse ? oData.zzpack_whse.toString() : "0",
                zzsize: oData.zzsize || "",
                postx: oData.postx || "",
                zzbdrsub: oData.zzbdrsub || "",
                status: oData.status || "P",
                statusText: oData.statusText || "Pending",
                trtyp: 'V'
            };
            
            BusyIndicator.show(0);
            
            var sServiceName = "ZODATA_KNMTREQUEST_SRV";
            var sEntitySetName = "ZCSD_ZKNMTRequest";
            var sEntityKey = Number(oData.reqno);
            var sUrl = "https://api.porky.com/sap/services/" + sServiceName + "/entities/" + sEntitySetName + "/" + sEntityKey;
            
            this._makeRequest(sUrl, {
                method: 'PATCH',
                body: JSON.stringify(oUpdateData)
            })
            .then(function(response) {
                if (!response.ok) {
                    return response.json().then(function(errorData) {
                        throw errorData;
                    });
                }
                return response.json();
            })
            .then(function(data) {
                BusyIndicator.hide();
                
                if(data.content && data.content[0] && data.content[0].text) {
                    var parsedData = JSON.parse(data.content[0].text);
                    if(parsedData.data && parsedData.data.error && parsedData.data.error.message && parsedData.data.error.message.value) {
                        MessageBox.error(parsedData.data.error.message.value);
                        return;
                    }
                }
                
                MessageBox.success("Changes saved successfully", {
                    onClose: function() {
                        var oDetailModel = that.getView().getModel("detailData");
                        oDetailModel.setProperty("/editMode", false);
                        oDetailModel.setProperty("/originalData", Object.assign({}, oUpdateData));
                        MessageToast.show("Edit mode disabled");
                        that._updateListModel(oUpdateData);
                    }
                });
            })
            .catch(function(error) {
                BusyIndicator.hide();
                var sMessage = "Error saving changes";
                if (error.error) sMessage = error.error;
                if (error.message) sMessage += ": " + error.message;
                MessageBox.error(sMessage);
            });
        },

                _deleteRecord: function(oData) {
            var that = this;
            
            var oUpdateData = {
                kunnr: oData.kunnr,
                vkorg: oData.vkorg,
                vtweg: oData.vtweg || "10",
                kdmat: oData.kdmat,
                zzloc: oData.zzloc || "",
                zzdepartment: oData.zzdepartment || "",
                zzmaterialusage: oData.zzmaterialusage || "",
                zzean11: oData.zzean11 || "",
                zzpack: oData.zzpack ? oData.zzpack.toString() : "0",
                zzuom: oData.zzuom || "",
                zzpack_whse: oData.zzpack_whse ? oData.zzpack_whse.toString() : "0",
                zzsize: oData.zzsize || "",
                postx: oData.postx || "",
                zzbdrsub: oData.zzbdrsub || "",
                status: oData.status || "P",
                statusText: oData.statusText || "Pending",
                trtyp: 'L'  // 'L' for Delete operation
            };
            
            BusyIndicator.show(0);
            
            var sServiceName = "ZODATA_KNMTREQUEST_SRV";
            var sEntitySetName = "ZCSD_ZKNMTRequest";
            var sEntityKey = Number(oData.reqno);
            var sUrl = "https://api.porky.com/sap/services/" + sServiceName + "/entities/" + sEntitySetName + "/" + sEntityKey;
            
            this._makeRequest(sUrl, {
                method: 'PATCH',
                body: JSON.stringify(oUpdateData)
            })
            .then(function(response) {
                if (!response.ok) {
                    return response.json().then(function(errorData) {
                        throw errorData;
                    });
                }
                return response.json();
            })
            .then(function(data) {
                BusyIndicator.hide();
                
                if(data.content && data.content[0] && data.content[0].text) {
                    var parsedData = JSON.parse(data.content[0].text);
                    if(parsedData.data && parsedData.data.error && parsedData.data.error.message && parsedData.data.error.message.value) {
                        MessageBox.error(parsedData.data.error.message.value);
                        return;
                    }
                }
                
                MessageBox.success("Record deleted successfully", {
                    onClose: function() {
                        var oDetailModel = that.getView().getModel("detailData");
                        oDetailModel.setProperty("/editMode", false);
                        oDetailModel.setProperty("/originalData", Object.assign({}, oUpdateData));
                        MessageToast.show("Edit mode disabled");
                        that._updateListModel(oUpdateData);

                        that._fetchDetailDataFromServer(oDetailModel.getData().kunnr, oDetailModel.getData().vkorg, oDetailModel.getData().kdmat);
                    }
                });
            })
            .catch(function(error) {
                BusyIndicator.hide();
                var sMessage = "Error saving changes";
                if (error.error) sMessage = error.error;
                if (error.message) sMessage += ": " + error.message;
                MessageBox.error(sMessage);
            });
        },

        _updateListModel: function(oUpdatedData) {
            var oComponent = this.getOwnerComponent();
            var oListModel = oComponent.getModel("listData");
            
            if (oListModel) {
                var aItems = oListModel.getProperty("/items/data");
                var iIndex = aItems.findIndex(function(item) {
                    return item.kunnr === oUpdatedData.kunnr && 
                           item.vkorg === oUpdatedData.vkorg && 
                           item.vtweg === oUpdatedData.vtweg &&
                           item.kdmat === oUpdatedData.kdmat;
                });
                
                if (iIndex !== -1) {
                    aItems[iIndex] = Object.assign(aItems[iIndex], oUpdatedData);
                    oListModel.setProperty("/items/data", aItems);
                }
            }
        },

        onCancelEdit: function() {
            var oModel = this.getView().getModel("detailData");
            var oOriginalData = oModel.getProperty("/originalData");
            
            MessageBox.confirm(
                "Do you want to discard your changes?",
                {
                    title: "Discard Changes",
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.OK) {
                            oModel.setData(Object.assign({}, oOriginalData, {
                                editMode: false,
                                originalData: oOriginalData
                            }));
                            MessageToast.show("Changes discarded");
                        }
                    }
                }
            );
        },

        onDelete: function() {
            var that = this;
            var oModel = this.getView().getModel("detailData");
            var oData = oModel.getData();
            
            MessageBox.confirm(
                "Do you want to delete this KNMT Request?\n\nCustomer: " + oData.kunnr + "\nMaterial: " + oData.kdmat,
                {
                    title: "Confirm Delete",
                    icon: MessageBox.Icon.WARNING,
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.DELETE,
                    onClose: function(oAction) {
                        if (oAction === MessageBox.Action.DELETE) {
                            that._deleteRecord(oData);
                        }
                    }
                }
            );
        },

        _deleteRecord1: function(oData) {
            var that = this;
            BusyIndicator.show(0);
            
            var sServiceName = "ZODATA_KNMTREQUEST_SRV";
            var sEntitySetName = "ZCSD_ZKNMTRequest";
            var sEntityKey = Number(oData.reqno);
            var sUrl = "https://api.porky.com/sap/services/" + sServiceName + "/entities/" + sEntitySetName + "/" + sEntityKey;
            
            this._makeRequest(sUrl, {
                method: 'DELETE'
            })
            .then(function(response) {
                if (!response.ok) {
                    return response.json().then(function(errorData) {
                        throw errorData;
                    });
                }
                return response.json();
            })
            .then(function(data) {
                BusyIndicator.hide();
                
                if(data.content && data.content[0] && data.content[0].text) {
                    var parsedData = JSON.parse(data.content[0].text);
                    if(parsedData.data && parsedData.data.error && parsedData.data.error.message && parsedData.data.error.message.value) {
                        MessageBox.error(parsedData.data.error.message.value);
                        return;
                    }
                }
                
                MessageBox.success("Record deleted successfully", {
                    onClose: function() {
                        that._navBack();
                    }
                });
            })
            .catch(function(error) {
                BusyIndicator.hide();
                var sMessage = "Error deleting record";
                if (error.error) sMessage = error.error;
                if (error.message) sMessage += ": " + error.message;
                MessageBox.error(sMessage);
            });
        },

        onCancel: function() {
            var oModel = this.getView().getModel("detailData");
            var bEditMode = oModel.getProperty("/editMode");
            
            if (bEditMode) {
                this.onCancelEdit();
            } else {
                this._navBack();
            }
        },

        _navBack: function() {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("list", {}, true);
            }
        },

        // ==================== LOCATION F4 & AUTO-SUGGEST ====================
        
        _preloadLocationData: function(sKunnr, sVkorg) {
            var that = this;
            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZBSD_ZKNMTLocation?filter=Customer eq '" + sKunnr + "' and SalesOrganization eq '" + sVkorg + "'";
            
            this._makeRequest(sUrl, {
                method: 'GET'
            })
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    var aLocations = [];
                    if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                        var parsedData = JSON.parse(data.content[0].text);
                        if (parsedData && Array.isArray(parsedData.data)) {
                            aLocations = parsedData.data;
                        }
                    }
                    that._aLocationCache = aLocations;
                })
                .catch(function(error) {
                    console.error("Error preloading locations:", error);
                });
        },

        onLocationSuggest: function(oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("suggestValue");
            
            if (!this._aLocationCache) {
                return;
            }

            var aSuggestions = this._aLocationCache.filter(function(oLocation) {
                return oLocation.Location && oLocation.Location.toLowerCase().indexOf(sValue.toLowerCase()) !== -1;
            });

            oInput.destroySuggestionItems();
            aSuggestions.forEach(function(oLocation) {
                oInput.addSuggestionItem(new sap.ui.core.Item({
                    key: oLocation.Location,
                    text: oLocation.Location
                }));
            });
        },

        onLocationSelected: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sLocation = oSelectedItem.getText();
                this.getView().getModel("detailData").setProperty("/zzloc", sLocation);
            }
        },

        onLocationValueHelp: function() {
            var that = this;
            var oModel = this.getView().getModel("detailData");
            var sKunnr = oModel.getProperty("/kunnr");
            var sVkorg = oModel.getProperty("/vkorg");

            if (!this._oLocationDialog) {
                this._oLocationDialog = new sap.m.SelectDialog({
                    title: "Select Location",
                    search: function(oEvent) {
                        var sValue = oEvent.getParameter("value");
                        var oFilter = new Filter("Location", FilterOperator.Contains, sValue);
                        var oBinding = oEvent.getSource().getBinding("items");
                        oBinding.filter([oFilter]);
                    },
                    confirm: function(oEvent) {
                        var oSelectedItem = oEvent.getParameter("selectedItem");
                        if (oSelectedItem) {
                            var sLocation = oSelectedItem.getTitle();
                            that.getView().getModel("detailData").setProperty("/zzloc", sLocation);
                        }
                    },
                    cancel: function() {
                        that._oLocationDialog.destroy();
                        that._oLocationDialog = null;
                    }
                });
            }

            this._loadLocationDataForDialog(sKunnr, sVkorg);
        },

        _loadLocationDataForDialog: function(sKunnr, sVkorg) {
            var that = this;
            
            if (this._aLocationCache) {
                this._displayLocationDialog(this._aLocationCache);
                return;
            }

            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZBSD_ZKNMTLocation?filter=Customer eq '" + sKunnr + "' and SalesOrganization eq '" + sVkorg + "'";
            BusyIndicator.show(0);
            
            this._makeRequest(sUrl, {
                method: 'GET'
            })
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    BusyIndicator.hide();
                    
                    var aLocations = [];
                    if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                        var parsedData = JSON.parse(data.content[0].text);
                        if (parsedData && Array.isArray(parsedData.data)) {
                            aLocations = parsedData.data;
                        }
                    }
                    
                    that._aLocationCache = aLocations;
                    that._displayLocationDialog(aLocations);
                })
                .catch(function(error) {
                    BusyIndicator.hide();
                    MessageBox.error("Error loading locations: " + error.message);
                });
        },

        _displayLocationDialog: function(aLocations) {
            var oLocationModel = new JSONModel(aLocations);
            this._oLocationDialog.setModel(oLocationModel);
            
            this._oLocationDialog.bindAggregation("items", {
                path: "/",
                template: new sap.m.StandardListItem({
                    title: "{Location}"
                })
            });
            
            this._oLocationDialog.open();
        },

        // ==================== DEPARTMENT F4 & AUTO-SUGGEST ====================
        
        _preloadDepartmentData: function(sKunnr, sVkorg) {
            var that = this;
            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZBSD_ZKNMTDepartment?filter=Customer eq '" + sKunnr + "' and SalesOrganization eq '" + sVkorg + "'";
            
            this._makeRequest(sUrl, {
                method: 'GET'
            })
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    var aDepartments = [];
                    if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                        var parsedData = JSON.parse(data.content[0].text);
                        if (parsedData && Array.isArray(parsedData.data)) {
                            aDepartments = parsedData.data;
                        }
                    }
                    that._aDepartmentCache = aDepartments;
                })
                .catch(function(error) {
                    console.error("Error preloading departments:", error);
                });
        },

        onDepartmentSuggest: function(oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("suggestValue");
            
            if (!this._aDepartmentCache) {
                return;
            }

            var aSuggestions = this._aDepartmentCache.filter(function(oDept) {
                return oDept.Department && oDept.Department.toLowerCase().indexOf(sValue.toLowerCase()) !== -1;
            });

            oInput.destroySuggestionItems();
            aSuggestions.forEach(function(oDept) {
                oInput.addSuggestionItem(new sap.ui.core.Item({
                    key: oDept.Department,
                    text: oDept.Department
                }));
            });
        },

        onDepartmentSelected: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sDepartment = oSelectedItem.getText();
                this.getView().getModel("detailData").setProperty("/zzdepartment", sDepartment);
            }
        },

        onDepartmentValueHelp: function() {
            var that = this;
            var oModel = this.getView().getModel("detailData");
            var sKunnr = oModel.getProperty("/kunnr");
            var sVkorg = oModel.getProperty("/vkorg");

            if (!this._oDepartmentDialog) {
                this._oDepartmentDialog = new sap.m.SelectDialog({
                    title: "Select Department",
                    search: function(oEvent) {
                        var sValue = oEvent.getParameter("value");
                        var oFilter = new Filter("Department", FilterOperator.Contains, sValue);
                        var oBinding = oEvent.getSource().getBinding("items");
                        oBinding.filter([oFilter]);
                    },
                    confirm: function(oEvent) {
                        var oSelectedItem = oEvent.getParameter("selectedItem");
                        if (oSelectedItem) {
                            var sDepartment = oSelectedItem.getTitle();
                            that.getView().getModel("detailData").setProperty("/zzdepartment", sDepartment);
                        }
                    },
                    cancel: function() {
                        that._oDepartmentDialog.destroy();
                        that._oDepartmentDialog = null;
                    }
                });
            }

            this._loadDepartmentDataForDialog(sKunnr, sVkorg);
        },

        _loadDepartmentDataForDialog: function(sKunnr, sVkorg) {
            var that = this;
            
            if (this._aDepartmentCache) {
                this._displayDepartmentDialog(this._aDepartmentCache);
                return;
            }

            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZBSD_ZKNMTDepartment?filter=Customer eq '" + sKunnr + "' and SalesOrganization eq '" + sVkorg + "'";
            BusyIndicator.show(0);
            
            this._makeRequest(sUrl, {
                method: 'GET'
            })
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    BusyIndicator.hide();
                    
                    var aDepartments = [];
                    if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                        var parsedData = JSON.parse(data.content[0].text);
                        if (parsedData && Array.isArray(parsedData.data)) {
                            aDepartments = parsedData.data;
                        }
                    }
                    
                    that._aDepartmentCache = aDepartments;
                    that._displayDepartmentDialog(aDepartments);
                })
                .catch(function(error) {
                    BusyIndicator.hide();
                    MessageBox.error("Error loading departments: " + error.message);
                });
        },

        _displayDepartmentDialog: function(aDepartments) {
            var oDepartmentModel = new JSONModel(aDepartments);
            this._oDepartmentDialog.setModel(oDepartmentModel);
            
            this._oDepartmentDialog.bindAggregation("items", {
                path: "/",
                template: new sap.m.StandardListItem({
                    title: "{Department}"
                })
            });
            
            this._oDepartmentDialog.open();
        },

        // ==================== MATERIAL USAGE F4 & AUTO-SUGGEST ====================
        
        _preloadMaterialUsageData: function() {
            var that = this;
            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZI_CUSTOMERMATERIALUsage";
            
            this._makeRequest(sUrl, {
                method: 'GET'
            })
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    var aUsages = [];
                    if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                        var parsedData = JSON.parse(data.content[0].text);
                        if (parsedData && Array.isArray(parsedData.data)) {
                            aUsages = parsedData.data;
                        }
                    }
                    that._aMaterialUsageCache = aUsages;
                })
                .catch(function(error) {
                    console.error("Error preloading material usage:", error);
                });
        },

        _preloadTransactionTypeData: function() {
    var that = this;
    var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZI_TransactionType";
    
    this._makeRequest(sUrl, {
        method: 'GET'
    })
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            var aTransactionTypes = [];
            if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                var parsedData = JSON.parse(data.content[0].text);
                if (parsedData && Array.isArray(parsedData.data)) {
                    aTransactionTypes = parsedData.data;
                }
            }
            that._aTransactionTypeCache = aTransactionTypes;
        })
        .catch(function(error) {
            console.error("Error preloading transaction types:", error);
        });
},

        onMaterialUsageSuggest: function(oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("suggestValue");
            
            if (!this._aMaterialUsageCache) {
                return;
            }

            var aSuggestions = this._aMaterialUsageCache.filter(function(oUsage) {
                var sSearchValue = sValue.toLowerCase();
                return (oUsage.Value && oUsage.Value.toLowerCase().indexOf(sSearchValue) !== -1) ||
                       (oUsage.Description && oUsage.Description.toLowerCase().indexOf(sSearchValue) !== -1);
            });

            oInput.destroySuggestionItems();
            aSuggestions.forEach(function(oUsage) {
                oInput.addSuggestionItem(new sap.ui.core.Item({
                    key: oUsage.Value,
                    text: oUsage.Value + " - " + (oUsage.Description || "")
                }));
            });
        },

        onMaterialUsageSelected: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sValue = oSelectedItem.getKey();
                this.getView().getModel("detailData").setProperty("/zzmaterialusage", sValue);
            }
        },

        onMaterialUsageValueHelp: function() {
            var that = this;

            if (!this._oMaterialUsageDialog) {
                this._oMaterialUsageDialog = new sap.m.SelectDialog({
                    title: "Select Material Usage",
                    search: function(oEvent) {
                        var sValue = oEvent.getParameter("value");
                        var aFilters = [
                            new Filter("Value", FilterOperator.Contains, sValue),
                            new Filter("Description", FilterOperator.Contains, sValue)
                        ];
                        var oFilter = new Filter({
                            filters: aFilters,
                            and: false
                        });
                        var oBinding = oEvent.getSource().getBinding("items");
                        oBinding.filter([oFilter]);
                    },
                    confirm: function(oEvent) {
                        var oSelectedItem = oEvent.getParameter("selectedItem");
                        if (oSelectedItem) {
                            var sValue = oSelectedItem.getTitle();
                            that.getView().getModel("detailData").setProperty("/zzmaterialusage", sValue);
                        }
                    },
                    cancel: function() {
                        that._oMaterialUsageDialog.destroy();
                        that._oMaterialUsageDialog = null;
                    }
                });
            }

            this._loadMaterialUsageDataForDialog();
        },

        _loadMaterialUsageDataForDialog: function() {
            var that = this;
            
            if (this._aMaterialUsageCache) {
                this._displayMaterialUsageDialog(this._aMaterialUsageCache);
                return;
            }

            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZI_CUSTOMERMATERIALUsage";
            BusyIndicator.show(0);
            
            this._makeRequest(sUrl, {
                method: 'GET'
            })
                .then(function(response) {
                    return response.json();
                })
                .then(function(data) {
                    BusyIndicator.hide();
                    
                    var aUsages = [];
                    if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                        var parsedData = JSON.parse(data.content[0].text);
                        if (parsedData && Array.isArray(parsedData.data)) {
                            aUsages = parsedData.data;
                        }
                    }
                    
                    that._aMaterialUsageCache = aUsages;
                    that._displayMaterialUsageDialog(aUsages);
                })
                .catch(function(error) {
                    BusyIndicator.hide();
                    MessageBox.error("Error loading material usage options: " + error.message);
                });
        },

        _displayMaterialUsageDialog: function(aUsages) {
            var oUsageModel = new JSONModel(aUsages);
            this._oMaterialUsageDialog.setModel(oUsageModel);
            
            this._oMaterialUsageDialog.bindAggregation("items", {
                path: "/",
                template: new sap.m.StandardListItem({
                    title: "{Value}",
                    description: "{Description}"
                })
            });
            
            this._oMaterialUsageDialog.open();
        },

        onTransactionTypeSuggest: function(oEvent) {
    var oInput = oEvent.getSource();
    var sValue = oEvent.getParameter("suggestValue");
    
    if (!this._aTransactionTypeCache) {
        return;
    }

    var aSuggestions = this._aTransactionTypeCache.filter(function(oType) {
        var sSearchValue = sValue.toLowerCase();
        return (oType.Value && oType.Value.toLowerCase().indexOf(sSearchValue) !== -1) ||
               (oType.Description && oType.Description.toLowerCase().indexOf(sSearchValue) !== -1);
    });

    oInput.destroySuggestionItems();
    aSuggestions.forEach(function(oType) {
        oInput.addSuggestionItem(new sap.ui.core.Item({
            key: oType.Value,
            text: oType.Value + " - " + (oType.Description || "")
        }));
    });
},

formatDate: function(dateString) {
        if (!dateString) return "";
        
        // Extract timestamp from Date(1760024191000+0000) format
        var timestamp = parseInt(dateString.match(/\d+/)[0]);
        var date = new Date(timestamp);
        
        var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
            pattern: "MM.dd.yyyy HH:mm:ss"
        });
        
        return oDateFormat.format(date);
    },

onTransactionTypeSelected: function(oEvent) {
    var oSelectedItem = oEvent.getParameter("selectedItem");
    if (oSelectedItem) {
        var sValue = oSelectedItem.getKey();
        this.getView().getModel("detailData").setProperty("/trtyp", sValue);
    }
},

onTransactionTypeValueHelp: function() {
    var that = this;

    if (!this._oTransactionTypeDialog) {
        this._oTransactionTypeDialog = new sap.m.SelectDialog({
            title: "Select Transaction Type",
            search: function(oEvent) {
                var sValue = oEvent.getParameter("value");
                var aFilters = [
                    new Filter("Value", FilterOperator.Contains, sValue),
                    new Filter("Description", FilterOperator.Contains, sValue)
                ];
                var oFilter = new Filter({
                    filters: aFilters,
                    and: false
                });
                var oBinding = oEvent.getSource().getBinding("items");
                oBinding.filter([oFilter]);
            },
            confirm: function(oEvent) {
                var oSelectedItem = oEvent.getParameter("selectedItem");
                if (oSelectedItem) {
                    var sValue = oSelectedItem.getTitle();
                    that.getView().getModel("detailData").setProperty("/trtyp", sValue);
                }
            },
            cancel: function() {
                that._oTransactionTypeDialog.destroy();
                that._oTransactionTypeDialog = null;
            }
        });
    }

    this._loadTransactionTypeDataForDialog();
},

_loadTransactionTypeDataForDialog: function() {
    var that = this;
    
    if (this._aTransactionTypeCache) {
        this._displayTransactionTypeDialog(this._aTransactionTypeCache);
        return;
    }

    var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZI_TransactionType";
    BusyIndicator.show(0);
    
    this._makeRequest(sUrl, {
        method: 'GET'
    })
        .then(function(response) {
            return response.json();
        })
        .then(function(data) {
            BusyIndicator.hide();
            
            var aTransactionTypes = [];
            if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                var parsedData = JSON.parse(data.content[0].text);
                if (parsedData && Array.isArray(parsedData.data)) {
                    aTransactionTypes = parsedData.data;
                }
            }
            
            that._aTransactionTypeCache = aTransactionTypes;
            that._displayTransactionTypeDialog(aTransactionTypes);
        })
        .catch(function(error) {
            BusyIndicator.hide();
            MessageBox.error("Error loading transaction types: " + error.message);
        });
},

_displayTransactionTypeDialog: function(aTransactionTypes) {
    var oTransactionTypeModel = new JSONModel(aTransactionTypes);
    this._oTransactionTypeDialog.setModel(oTransactionTypeModel);
    
    this._oTransactionTypeDialog.bindAggregation("items", {
        path: "/",
        template: new sap.m.StandardListItem({
            title: "{Value}",
            description: "{Description}"
        })
    });
    
    this._oTransactionTypeDialog.open();
}

    });
});