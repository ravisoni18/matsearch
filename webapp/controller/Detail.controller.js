sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator"
], function (Controller, History, JSONModel, MessageBox, MessageToast, BusyIndicator) {
    "use strict";

    return Controller.extend("knmtapp.controller.Detail", {
        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("detail").attachPatternMatched(this._onObjectMatched, this);
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
            
            console.log("Component:", oComponent);
            console.log("ListModel:", oListModel);
            
            if (!oListModel) {
                MessageBox.error("List data model not found. Please go back and refresh the list.");
                this._navBack();
                return;
            }
            
            var aItems = oListModel.getProperty("/items/data");
            
            console.log("Items from model:", aItems);
            
            if (!aItems || aItems.length === 0) {
                MessageBox.error("No data available. Please go back and refresh the list.");
                this._navBack();
                return;
            }
            
            var oItem = aItems.find(function(item) {
                return item.kunnr === sKunnr && 
                       item.vkorg === sVkorg && 
                       item.kdmat === sKdmat;
            });
            
            console.log("Found item:", oItem);
            
            if (oItem) {
                var oDetailData = Object.assign({}, oItem, {
                    editMode: false,
                    originalData: Object.assign({}, oItem)
                });
                
                // Ensure vtweg exists with default value if missing
                if (!oDetailData.vtweg) {
                    oDetailData.vtweg = "01"; // Default distribution channel
                    console.warn("vtweg missing, using default: 01");
                }
                
                var oDetailModel = new JSONModel(oDetailData);
                this.getView().setModel(oDetailModel, "detailData");
            } else {
                MessageBox.error("Record not found. Customer: " + sKunnr + ", Material: " + sKdmat);
                this._navBack();
            }
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
            
            // Prepare data for update
            var oUpdateData = {
                kunnr: oData.kunnr,
                vkorg: oData.vkorg,
                vtweg: oData.vtweg || "01", // Distribution Channel - required key field
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
                statusText: oData.statusText || "Pending"
            };
            
            BusyIndicator.show(0);
            
            // Use MCP server endpoint for update
            var sServiceName = "ZODATA_KNMTREQUEST_SRV";
            var sEntitySetName = "ZCSD_ZKNMTRequest";
            var sEntityKey = "kunnr='" + oData.kunnr + "',vkorg='" + oData.vkorg + "',vtweg='" + (oData.vtweg || "01") + "',kdmat='" + oData.kdmat + "'";
            var sUrl = "https://mcp.porky.com/sap/services/" + sServiceName + "/entities/" + sEntitySetName + "/" + sEntityKey;
            
            fetch(sUrl, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
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
                
                // Check for error in response
                if(data.content && data.content[0] && data.content[0].text) {
                    var parsedData = JSON.parse(data.content[0].text);
                    if(parsedData.data && parsedData.data.error && parsedData.data.error.message && parsedData.data.error.message.value) {
                        var sMessage = parsedData.data.error.message.value;
                        MessageBox.error(sMessage);
                        return;
                    }
                }
                
                MessageBox.success("Changes saved successfully", {
                    onClose: function() {
                        var oDetailModel = that.getView().getModel("detailData");
                        oDetailModel.setProperty("/editMode", false);
                        oDetailModel.setProperty("/originalData", Object.assign({}, oUpdateData));
                        MessageToast.show("Edit mode disabled");
                        
                        // Update the list model as well
                        that._updateListModel(oUpdateData);
                    }
                });
            })
            .catch(function(error) {
                BusyIndicator.hide();
                
                var sMessage = "Error saving changes";
                if (error.error) {
                    sMessage = error.error;
                }
                if (error.message) {
                    sMessage += ": " + error.message;
                }
                
                console.error("Update error:", error);
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

        _deleteRecord: function(oData) {
            var that = this;
            
            BusyIndicator.show(0);
            
            var sServiceName = "ZODATA_KNMTREQUEST_SRV";
            var sEntitySetName = "ZCSD_ZKNMTRequest";
            var sEntityKey = "kunnr='" + oData.kunnr + "',vkorg='" + oData.vkorg + "',vtweg='" + (oData.vtweg || "01") + "',kdmat='" + oData.kdmat + "'";
            var sUrl = "https://mcp.porky.com/sap/services/" + sServiceName + "/entities/" + sEntitySetName + "/" + sEntityKey;
            
            fetch(sUrl, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
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
                
                // Check for error in response
                if(data.content && data.content[0] && data.content[0].text) {
                    var parsedData = JSON.parse(data.content[0].text);
                    if(parsedData.data && parsedData.data.error && parsedData.data.error.message && parsedData.data.error.message.value) {
                        var sMessage = parsedData.data.error.message.value;
                        MessageBox.error(sMessage);
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
                if (error.error) {
                    sMessage = error.error;
                }
                if (error.message) {
                    sMessage += ": " + error.message;
                }
                
                console.error("Delete error:", error);
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
        }
    });
});