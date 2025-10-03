sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (Controller, Filter, FilterOperator, JSONModel, MessageBox, MessageToast,Fragment) {
    "use strict";

    return Controller.extend("knmtapp.controller.List", {
        onInit: function () {
            // Create the listData model on component if it doesn't exist
            var oComponent = this.getOwnerComponent();
            var oListDataModel = oComponent.getModel("listData");
            
            if (!oListDataModel) {
                console.log("Creating listData model in List controller...");
                oListDataModel = new JSONModel({
                    items: {
                        data: [],
                        length: 0
                    },
                    analytics: {
                        total: 0,
                        pending: 0,
                        completed: 0,
                        rejected: 0
                    }
                });
                oComponent.setModel(oListDataModel, "listData");
            }
            
            // Initialize local state model for UI settings
            this._initializeLocalModel();
            
            this._loadData();
        },

        _initializeLocalModel: function() {
            var oLocalModel = new JSONModel({
                compactMode: false,
                itemsPerPage: 20
            });
            this.getView().setModel(oLocalModel, "localSettings");
        },

        _loadData: function() {
            var that = this;
            var sUrl = "https://mcp.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZCSD_ZKNMTRequest";
            
            this.getView().setBusy(true);
            var oTempModel = new JSONModel();
            oTempModel.loadData(sUrl);
            
            oTempModel.attachRequestCompleted(function(oEvent) {
                that.getView().setBusy(false);
                if (oEvent.getParameter("success")) {
                    var oData = oTempModel.getData();
                    var aItems = [];
                    
                    // Parse your specific data structure
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
                    
                    console.log("Loaded items count:", aItems.length);
                    
                    // Calculate analytics
                    var oAnalytics = that._calculateAnalytics(aItems);
                    
                    // Set data on component's global model
                    var oListDataModel = that.getOwnerComponent().getModel("listData");
                    oListDataModel.setData({ 
                        items: {
                            data: aItems,
                            length: aItems.length
                        },
                        analytics: oAnalytics
                    });
                    
                    MessageToast.show("Data loaded successfully. " + aItems.length + " records found.");
                } else {
                    MessageBox.error("Failed to load data from server");
                }
            });
            
            oTempModel.attachRequestFailed(function(oError) {
                that.getView().setBusy(false);
                console.error("Request failed:", oError);
                MessageBox.error("Error loading data. Please check your connection.");
            });
        },

        _calculateAnalytics: function(aItems) {
            var oAnalytics = {
                total: aItems.length,
                pending: 0,
                completed: 0,
                rejected: 0
            };
            
            aItems.forEach(function(item) {
                if (item.status === 'P') {
                    oAnalytics.pending++;
                } else if (item.status === 'C') {
                    oAnalytics.completed++;
                } else if (item.status === 'R') {
                    oAnalytics.rejected++;
                }
            });
            
            return oAnalytics;
        },

        onTilePress: function(oEvent) {
            var oTile = oEvent.getSource();
            var sStatus = oTile.data("status");
            
            console.log("Tile pressed with status:", sStatus);
            
            // Clear other filters first
            this.byId("filterKunnr").setValue("");
            this.byId("filterVkorg").setValue("");
            this.byId("filterKdmat").setValue("");
            this.byId("filterPostx").setValue("");
            this.byId("filterZzean11").setValue("");
            this.byId("filterZzloc").setValue("");
            this.byId("filterErnam").setValue("");
            this.byId("filterCreatedDate").setValue(null);
            this.byId("filterChangedDate").setValue(null);
            
            // Set status filter
            if (sStatus === "ALL") {
                this.byId("filterStatus").setSelectedKey("");
                MessageToast.show("Showing all requests");
            } else {
                this.byId("filterStatus").setSelectedKey(sStatus);
                var sStatusText = sStatus === 'P' ? 'Pending' : sStatus === 'C' ? 'Completed' : 'Rejected';
                MessageToast.show("Filtered by: " + sStatusText);
            }
            
            // Apply the filter
            this.onSearch();
        },

        formatStatus: function(status) {
            if (status === 'P') return 'Warning';
            if (status === 'A') return 'Success';
            if (status === 'R') return 'Error';
            return 'None';
        },

        formatDate: function(sDate) {
            if (!sDate) return "";
            
            try {
                // Parse SAP date format /Date(timestamp)/
                var timestamp = parseInt(sDate.match(/\d+/)[0]);
                var oDate = new Date(timestamp);
                
                var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                    pattern: "MMM dd, yyyy"
                });
                
                return oDateFormat.format(oDate);
            } catch(e) {
                return "";
            }
        },

        // Helper function to parse SAP dates
        _parseSAPDate: function(sDate) {
            if (!sDate) return null;
            try {
                // Parse SAP date format /Date(timestamp)/
                var timestamp = parseInt(sDate.match(/\d+/)[0]);
                return new Date(timestamp);
            } catch(e) {
                return null;
            }
        },

        onQuickSearch: function(oEvent) {
            var sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue");
            var oTable = this.byId("requestTable");
            var oBinding = oTable.getBinding("items");
            
            if (!oBinding) {
                return;
            }
            
            var aFilters = [];
            
            if (sQuery && sQuery.length > 0) {
                // Search across multiple fields
                var aQuickFilters = [
                    new Filter("kunnr", FilterOperator.Contains, sQuery),
                    new Filter("vkorg", FilterOperator.Contains, sQuery),
                    new Filter("kdmat", FilterOperator.Contains, sQuery),
                    new Filter("postx", FilterOperator.Contains, sQuery),
                    new Filter("zzean11", FilterOperator.Contains, sQuery),
                    new Filter("zzloc", FilterOperator.Contains, sQuery),
                    new Filter("ernam", FilterOperator.Contains, sQuery)
                ];
                
                aFilters.push(new Filter({
                    filters: aQuickFilters,
                    and: false
                }));
            }
            
            oBinding.filter(aFilters);
            
            var iCount = oBinding.getLength();
            if (sQuery) {
                MessageToast.show(iCount + " records found for '" + sQuery + "'");
            }
        },

        onSearch: function() {
            var oTable = this.byId("requestTable");
            var oBinding = oTable.getBinding("items");
            
            if (!oBinding) {
                MessageBox.warning("No data to search");
                return;
            }
            
            var aFilters = [];

            // Text filters
            var sKunnr = this.byId("filterKunnr").getValue();
            var sVkorg = this.byId("filterVkorg").getValue();
            var sStatus = this.byId("filterStatus").getSelectedKey();
            var sKdmat = this.byId("filterKdmat").getValue();
            var sPostx = this.byId("filterPostx").getValue();
            var sZzean11 = this.byId("filterZzean11").getValue();
            var sZzloc = this.byId("filterZzloc").getValue();
            var sErnam = this.byId("filterErnam").getValue();

            if (sKunnr) aFilters.push(new Filter("kunnr", FilterOperator.Contains, sKunnr));
            if (sVkorg) aFilters.push(new Filter("vkorg", FilterOperator.Contains, sVkorg));
            if (sStatus) aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            if (sKdmat) aFilters.push(new Filter("kdmat", FilterOperator.Contains, sKdmat));
            if (sPostx) aFilters.push(new Filter("postx", FilterOperator.Contains, sPostx));
            if (sZzean11) aFilters.push(new Filter("zzean11", FilterOperator.Contains, sZzean11));
            if (sZzloc) aFilters.push(new Filter("zzloc", FilterOperator.Contains, sZzloc));
            if (sErnam) aFilters.push(new Filter("ernam", FilterOperator.Contains, sErnam));
            
            // Handle Created Date DynamicDateRange
            var oCreatedDateRange = this.byId("filterCreatedDate");
            var oCreatedValue = oCreatedDateRange.getValue();
            if (oCreatedValue && oCreatedValue.values) {
                try {
                    var aCreatedDates = oCreatedValue.values;
                    if (aCreatedDates && aCreatedDates.length > 0) {
                        var oStartDate = new Date(aCreatedDates[0]);
                        var oEndDate;
                        
                        if (aCreatedDates.length >= 2) {
                            oEndDate = new Date(aCreatedDates[1]);
                        } else {
                            oEndDate = new Date(oStartDate);
                            oEndDate.setHours(23, 59, 59, 999);
                        }
                        oStartDate.setHours(0, 0, 0, 0);
                        
                        // Create custom filter function to handle SAP date format
                        var fnCreatedDateFilter = function(sValue) {
                            var oItemDate = this._parseSAPDate(sValue);
                            if (!oItemDate) return false;
                            return oItemDate >= oStartDate && oItemDate <= oEndDate;
                        }.bind(this);
                        
                        aFilters.push(new Filter({
                            path: "createdatetime",
                            test: fnCreatedDateFilter
                        }));
                    }
                } catch (e) {
                    console.error("Error processing created date:", e);
                }
            }
            
            // Handle Changed Date DynamicDateRange
            var oChangedDateRange = this.byId("filterChangedDate");
            var oChangedValue = oChangedDateRange.getValue();
            if (oChangedValue && oChangedValue.values) {
                try {
                    var aChangedDates = oChangedValue.values;
                    if (aChangedDates && aChangedDates.length > 0) {
                        var oStartDate = new Date(aChangedDates[0]);
                        var oEndDate;
                        
                        if (aChangedDates.length >= 2) {
                            oEndDate = new Date(aChangedDates[1]);
                        } else {
                            oEndDate = new Date(oStartDate);
                            oEndDate.setHours(23, 59, 59, 999);
                        }
                        oStartDate.setHours(0, 0, 0, 0);
                        
                        // Create custom filter function to handle SAP date format
                        var fnChangedDateFilter = function(sValue) {
                            var oItemDate = this._parseSAPDate(sValue);
                            if (!oItemDate) return false;
                            return oItemDate >= oStartDate && oItemDate <= oEndDate;
                        }.bind(this);
                        
                        aFilters.push(new Filter({
                            path: "changedatetime",
                            test: fnChangedDateFilter
                        }));
                    }
                } catch (e) {
                    console.error("Error processing changed date:", e);
                }
            }

            oBinding.filter(aFilters);
            
            var iCount = oBinding.getLength();
            MessageToast.show(iCount + " records found");
        },

        onReset: function() {
            this.byId("filterKunnr").setValue("");
            this.byId("filterVkorg").setValue("");
            this.byId("filterStatus").setSelectedKey("");
            this.byId("filterKdmat").setValue("");
            this.byId("filterPostx").setValue("");
            this.byId("filterZzean11").setValue("");
            this.byId("filterZzloc").setValue("");
            this.byId("filterErnam").setValue("");
            
            // Clear DynamicDateRange controls
            this.byId("filterCreatedDate").setValue(null);
            this.byId("filterChangedDate").setValue(null);
            
            // Clear quick search
            var oSearchField = this.byId("searchField");
            if (oSearchField) {
                oSearchField.setValue("");
            }
            
            var oTable = this.byId("requestTable");
            var oBinding = oTable.getBinding("items");
            if (oBinding) {
                oBinding.filter([]);
            }
            
            MessageToast.show("Filters cleared");
        },

        onRefresh: function() {
            this.onReset();
            this._loadData();
        },


        onItemPress: function(oEvent) {
            console.log("onItemPress called!");
            
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("listData");
            
            console.log("Context:", oContext);
            
            if (!oContext) {
                MessageBox.error("Unable to get item context");
                return;
            }
            
            var oData = oContext.getObject();
            console.log("Item data:", oData);
            
            if (!oData || !oData.kunnr || !oData.vkorg || !oData.kdmat) {
                MessageBox.error("Invalid item data");
                return;
            }
            
            console.log("Navigating to detail with:", oData.kunnr, oData.vkorg, oData.kdmat);
            
            this.getOwnerComponent().getRouter().navTo("detail", {
                kunnr: oData.kunnr,
                vkorg: oData.vkorg,
                kdmat: oData.kdmat
            });
        },

        onToggleFilterPanel: function() {
            var oSidePanel = this.byId("filterSidePanel");
            var bSidePanelExpanded = oSidePanel.getSidePanelExpanded();
            oSidePanel.setSidePanelExpanded(!bSidePanelExpanded);
        },

        // Export Functions - Simple implementations without external libraries
        onExportToExcel: function() {
            var oTable = this.byId("requestTable");
            var oBinding = oTable.getBinding("items");
            
            if (!oBinding || oBinding.getLength() === 0) {
                MessageBox.warning("No data available to export");
                return;
            }
            
            // Get filtered data
            var aData = oBinding.getContexts().map(function(oContext) {
                return oContext.getObject();
            });
            
            // Convert to CSV (Excel can open CSV files)
            var sCSV = this._convertToExcelCSV(aData);
            this._downloadFile(sCSV, 'KNMT_Requests_' + new Date().getTime() + '.csv', 'text/csv;charset=utf-8;');
            
            MessageToast.show("Export completed - Open with Excel");
        },

        _convertToExcelCSV: function(aData) {
            // Excel-friendly CSV with UTF-8 BOM
            var BOM = "\uFEFF";
            var aHeaders = ['Customer', 'Sales Org', 'Material', 'Description', 'EAN', 'UOM', 'Location', 'Status', 'Created By', 'Created Date', 'Changed By', 'Changed Date'];
            var sCSV = BOM + aHeaders.join(',') + '\n';
            
            aData.forEach(function(oItem) {
                var aRow = [
                    this._escapeCSV(oItem.kunnr),
                    this._escapeCSV(oItem.vkorg),
                    this._escapeCSV(oItem.kdmat),
                    this._escapeCSV(oItem.postx),
                    this._escapeCSV(oItem.zzean11),
                    this._escapeCSV(oItem.zzuom),
                    this._escapeCSV(oItem.zzloc),
                    this._escapeCSV(oItem.status),
                    this._escapeCSV(oItem.ernam),
                    this._escapeCSV(this.formatDate(oItem.createdatetime)),
                    this._escapeCSV(oItem.last_changed_by_user),
                    this._escapeCSV(this.formatDate(oItem.changedatetime))
                ];
                sCSV += aRow.join(',') + '\n';
            }.bind(this));
            
            return sCSV;
        },

        onExportToPDF: function() {
            MessageBox.information(
                "PDF export options:\n\n" +
                "1. Use 'Print' button and select 'Save as PDF'\n" +
                "2. Export to Excel and convert to PDF\n" +
                "3. Contact administrator for custom PDF export setup",
                {
                    title: "PDF Export",
                    actions: [MessageBox.Action.OK]
                }
            );
        },

        onExportToCSV: function() {
            var oTable = this.byId("requestTable");
            var oBinding = oTable.getBinding("items");
            
            if (!oBinding || oBinding.getLength() === 0) {
                MessageBox.warning("No data available to export");
                return;
            }
            
            var aData = oBinding.getContexts().map(function(oContext) {
                return oContext.getObject();
            });
            
            var sCSV = this._convertToCSV(aData);
            this._downloadFile(sCSV, 'KNMT_Requests_' + new Date().getTime() + '.csv', 'text/csv;charset=utf-8;');
            
            MessageToast.show("CSV export completed");
        },

        _convertToCSV: function(aData) {
            var aHeaders = ['Customer', 'Sales Org', 'Material', 'Description', 'EAN', 'UOM', 'Location', 'Status', 'Created By', 'Created Date', 'Changed By', 'Changed Date'];
            var sCSV = aHeaders.join(',') + '\n';
            
            aData.forEach(function(oItem) {
                var aRow = [
                    this._escapeCSV(oItem.kunnr),
                    this._escapeCSV(oItem.vkorg),
                    this._escapeCSV(oItem.kdmat),
                    this._escapeCSV(oItem.postx),
                    this._escapeCSV(oItem.zzean11),
                    this._escapeCSV(oItem.zzuom),
                    this._escapeCSV(oItem.zzloc),
                    this._escapeCSV(oItem.status),
                    this._escapeCSV(oItem.ernam),
                    this._escapeCSV(this.formatDate(oItem.createdatetime)),
                    this._escapeCSV(oItem.last_changed_by_user),
                    this._escapeCSV(this.formatDate(oItem.changedatetime))
                ];
                sCSV += aRow.join(',') + '\n';
            }.bind(this));
            
            return sCSV;
        },

        _escapeCSV: function(sValue) {
            if (sValue === null || sValue === undefined) {
                return '';
            }
            sValue = String(sValue);
            if (sValue.includes(',') || sValue.includes('"') || sValue.includes('\n')) {
                sValue = '"' + sValue.replace(/"/g, '""') + '"';
            }
            return sValue;
        },

        _downloadFile: function(sContent, sFileName, sMimeType) {
            var blob = new Blob([sContent], { type: sMimeType });
            var link = document.createElement("a");
            var url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", sFileName);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        },

        // Settings Functions
        onChangeItemsPerPage: function(oEvent) {
            var sValue = oEvent.getParameter("selectedItem").getKey();
            var oTable = this.byId("requestTable");
            oTable.setGrowingThreshold(parseInt(sValue));
            
            MessageToast.show("Items per page set to " + sValue);
        },

        onToggleCompactMode: function(oEvent) {
            var bState = oEvent.getParameter("state");
            var oView = this.getView();
            
            if (bState) {
                oView.addStyleClass("sapUiSizeCompact");
                MessageToast.show("Compact mode enabled");
            } else {
                oView.removeStyleClass("sapUiSizeCompact");
                MessageToast.show("Compact mode disabled");
            }
        },












         // REPLACE the onNavigateToCreate method with this:
        onNavigateToCreate: function() {
            this._openCreateDialog();
        },

        // ADD these new methods:
        _openCreateDialog: function() {
            var oView = this.getView();
            
            if (!this._pCreateDialog) {
                this._pCreateDialog = Fragment.load({
                    id: oView.getId(),
                    name: "knmtapp.view.CreateDialog",
                    controller: this
                }).then(function(oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            
            this._pCreateDialog.then(function(oDialog) {
                // Reset form before opening
                this._resetCreateForm();
                oDialog.open();
            }.bind(this));
        },

        _resetCreateForm: function() {
            var oView = this.getView();
            
            // Reset all input fields
            oView.byId("createKunnr").setValue("").setValueState("None");
            oView.byId("createVkorg").setValue("").setValueState("None");
            oView.byId("createKdmat").setValue("").setValueState("None");
            oView.byId("createZzloc").setValue("");
            oView.byId("createZzdepartment").setValue("");
            oView.byId("createZzmaterialusage").setSelectedKey("");
            oView.byId("createZzean11").setValue("");
            oView.byId("createZzpack").setValue(1);
            oView.byId("createZzuom").setSelectedKey("CS");
            oView.byId("createZzpack_whse").setValue(1);
            oView.byId("createZzsize").setValue("");
            oView.byId("createPostx").setValue("");
            oView.byId("createZzbdrsub").setValue("");
        },

onCreateRequest: function() {
    var oView = this.getView();
    
    // Gather form data
    var oData = {
        kunnr: oView.byId("createKunnr").getValue().trim(),
        vkorg: oView.byId("createVkorg").getValue().trim(),
        kdmat: oView.byId("createKdmat").getValue().trim(),
        zzloc: oView.byId("createZzloc").getValue().trim(),
        zzdepartment: oView.byId("createZzdepartment").getValue().trim(),
        zzmaterialusage: oView.byId("createZzmaterialusage").getSelectedKey(),
        zzean11: oView.byId("createZzean11").getValue().trim(),
        zzpack: (oView.byId("createZzpack").getValue()).toString(),
        zzuom: oView.byId("createZzuom").getSelectedKey(),
        zzpack_whse: (oView.byId("createZzpack_whse").getValue()).toString(),
        zzsize: oView.byId("createZzsize").getValue().trim(),
        postx: oView.byId("createPostx").getValue().trim(),
        zzbdrsub: oView.byId("createZzbdrsub").getValue().trim(),
        status: "P",
        statusText: "Pending"
    };

    // Validation
    var bValid = true;
    
    if (!oData.kunnr) {
        oView.byId("createKunnr").setValueState("Error").setValueStateText("Customer number is required");
        bValid = false;
    } else {
        oView.byId("createKunnr").setValueState("None");
    }
    
    if (!oData.vkorg) {
        oView.byId("createVkorg").setValueState("Error").setValueStateText("Sales organization is required");
        bValid = false;
    } else {
        oView.byId("createVkorg").setValueState("None");
    }
    
    if (!oData.kdmat) {
        oView.byId("createKdmat").setValueState("Error").setValueStateText("Material number is required");
        bValid = false;
    } else {
        oView.byId("createKdmat").setValueState("None");
    }
    
    if (!bValid) {
        MessageBox.error("Please fill all required fields");
        return;
    }

    var that = this;
    oView.setBusy(true);

    // Use MCP server endpoint
    var sServiceName = "ZODATA_KNMTREQUEST_SRV";
    var sEntitySetName = "ZCSD_ZKNMTRequest";
    var sUrl = "https://mcp.porky.com/sap/services/" + sServiceName + "/entities/" + sEntitySetName;
    
    fetch(sUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(oData)
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
        oView.setBusy(false);

        if(data.content[0].text && JSON.parse(data.content[0].text).data  && JSON.parse(data.content[0].text).data.error&&  JSON.parse(data.content[0].text).data.error.message.value){
            var sMessage = JSON.parse(data.content[0].text).data.error.message.value;
            MessageBox.error(sMessage);
            return;
        }
        
        MessageBox.success("KNMT Request created successfully", {
            onClose: function() {
                // Close dialog
                that._pCreateDialog.then(function(oDialog) {
                    oDialog.close();
                });
                
                // Refresh the list
                that._loadData();
            }
        });
    })
    .catch(function(error) {
        oView.setBusy(false);
        
        var sMessage = "Error creating request";
        if (error.error) {
            sMessage = error.error;
        }
        if (error.message) {
            sMessage += ": " + error.message;
        }
        
        console.error("Create request error:", error);
        MessageBox.error(sMessage);
    });
},

        onCancelCreate: function() {
            this._pCreateDialog.then(function(oDialog) {
                oDialog.close();
            });
        },

        onDialogClose: function() {
            // Clean up if needed
            this._resetCreateForm();
        },
    });
});