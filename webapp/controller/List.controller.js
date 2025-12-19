sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/core/BusyIndicator"
], function (Controller, Filter, FilterOperator, JSONModel, MessageBox, MessageToast, Fragment, BusyIndicator) {
    "use strict";

    return Controller.extend("knmtapp.controller.List", {
        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("list").attachPatternMatched(this._onObjectMatched, this);
          
            var oComponent = this.getOwnerComponent();

            // Create the listData model on component if it doesn't exist
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
                        accepted: 0,
                        rejected: 0
                    }
                });
                oComponent.setModel(oListDataModel, "listData");
            }
            
            // Create processedData model for the new tab
            var oProcessedDataModel = new JSONModel({
                items: [],
                count: 0
            });
            this.getView().setModel(oProcessedDataModel, "processedData");
            
            // Initialize local state model for UI settings
            this._initializeLocalModel();
            
            // Initialize F4 help dialogs
            this._oCreateLocationDialog = null;
            this._oCreateDepartmentDialog = null;
            this._oCreateMaterialUsageDialog = null;
            
            // Initialize cache for auto-suggest
            this._aCreateLocationCache = null;
            this._aCreateDepartmentCache = null;
            this._aCreateMaterialUsageCache = null;
            this._aCreateTransactionTypeCache = null;

            // Load SheetJS library dynamically if not already loaded
            this._loadSheetJSLibrary();

            this.getOwnerComponent().getModel("currentUser").setProperty("/zsystem", this.getSystem())

        },

        /**
         * Helper function to get request headers based on environment
         */
        _getRequestHeaders: function() {
            var headers = {
                'Content-Type': 'application/json',
                'X-PORKY-AUTH': 'cm1lbGxveTpsdWNreW1l',
                'X-PORKY-APPID': 'PO',
                'X-PORKY-APIKEY': '6bb0b04a-0466-490e-a8a5-53278b3df025',
                'Authorization': 'Basic cm1lbGxveTpsdWNreW1l',
                'Access-Control-Allow-Origin': '*'
            };

            // Determine SYSID based on URL
            if (window.location.href.includes("DE2") || window.location.href.includes("de2")) {
                headers['X-PORKY-SYSID'] = 'DE2';
            } else if (window.location.href.includes("QA2") || window.location.href.includes("qa2")) {
                headers['X-PORKY-SYSID'] = 'QA2';
            } else {
                headers['X-PORKY-SYSID'] = 'DE2';
            }

            if( this.getSystem().toUpperCase()                === "DE2"){
                headers['X-PORKY-SYSID'] = 'DE2';
            }else   if( this.getSystem().toUpperCase() === "QA2"){
                headers['X-PORKY-SYSID'] = 'QA2';
            }
            else   if( this.getSystem().toUpperCase()=== "PRD" ||
            !this.getSystem() || this.getSystem().trim() === ""){
                headers['X-PORKY-SYSID'] = 'PRD';
            }
            return headers;
        },

        /**
         * Helper function to make fetch requests with proper headers
         */
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

        _loadSheetJSLibrary: function() {
            // Check if XLSX library is already loaded
            if (typeof XLSX !== 'undefined') {
                console.log("SheetJS library already loaded");
                return;
            }
            
            // Dynamically load SheetJS library
            var script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = function() {
                console.log("SheetJS library loaded successfully");
            };
            script.onerror = function() {
                console.error("Failed to load SheetJS library");
            };
            document.head.appendChild(script);
        },

        /**
         * Parse the MCP entitlements response and extract field values
         */
        parseEntitlementsMCPResponse: function(response) {
            var entitlements = {
                plant: null,
                supplier: null,
                salesOrg: null
            };

            try {
                // Handle MCP response structure
                var data = null;
                
                if (response.content && response.content[0] && response.content[0].text) {
                    // Parse the JSON content from MCP response
                    var parsedData = JSON.parse(response.content[0].text);
                    
                    if (parsedData.data && parsedData.data.error  && parsedData.data.length === 0) {
                        // Handle error response
                        var sMessage = parsedData.data.error.message && parsedData.data.error.message.value 
                            ? parsedData.data.error.message.value 
                            : "Error fetching user entitlements";
                        throw new Error(sMessage);
                    }
                    
                    data = parsedData;
                } else {
                    // Direct response format
                    data = response;
                }

                // Extract entitlements from the data
                if (data && data.d && data.d.results) {
                    // Standard OData format
                    data.d.results.forEach(function(entry) {
                        this.extractEntitlementField(entitlements, entry);
                    }.bind(this));
                } else if (data && Array.isArray(data)) {
                    // Array format
                    data.forEach(function(entry) {
                        this.extractEntitlementField(entitlements, entry);
                    }.bind(this));
                } else if (data && data.value && Array.isArray(data.value)) {
                    // OData v4 format
                    data.value.forEach(function(entry) {
                        this.extractEntitlementField(entitlements, entry);
                    }.bind(this));
                }else if (data.data && Array.isArray(data.data)) {
                    // Array format
                    data.data.forEach(function(entry) {
                        this.extractEntitlementField(entitlements, entry);
                    }.bind(this));
                } 

            } catch (error) {
                console.error("Error parsing MCP entitlements response:", error);
                throw error;
            }

            return entitlements;
        },

        extractEntitlementField: function(entitlements, entry) {
            switch (entry.Fieldname) {
                case 'WERKS':
                    entitlements.plant = entry.Fieldvalue;
                    break;
                case 'LIFNR':
                    entitlements.supplier = entry.Fieldvalue;
                    break;
                case 'VKORG':
                    entitlements.salesOrg = entry.Fieldvalue;
                    break;
                case 'KUNNR':
                    entitlements.customer = entry.Fieldvalue;
                    break;
            }
        },

        _onObjectMatched: function(oEvent) {
            var oComponent = this.getOwnerComponent();
            
            this._initializeLocalModel();
            var that = this;

            var promiseData = new Promise((resolve, reject) => {
                this.fetchUserEntitlements()
                    .then((entitlements) => {
                        var oListDataModel = new JSONModel({
                            authorized: true
                        });
                        that.getView().setModel(oListDataModel, "authorizedModel");
                        that.entitlements = entitlements;
                        that._loadData(entitlements.salesOrg,entitlements.customer);
                        resolve();
                    })
                    .catch((error) => {
                        console.error("Failed to fetch user entitlements:", error);
                        MessageToast.show("Could not load user preferences, using defaults");
                        sap.m.MessageBox.error("You are not authorized to view this page");

                        var oListDataModel = new JSONModel({
                            authorized: false
                        });
                        that.getView().setModel(oListDataModel, "authorizedModel");
                        resolve(); // Continue with defaults
                    });
            });
        },

        _initializeLocalModel: function() {
            var oLocalModel = new JSONModel({
                compactMode: false,
                itemsPerPage: 20
            });
            this.getView().setModel(oLocalModel, "localSettings");
        },

        _loadData: function(salesorg,kunnr) {
            var that = this;
            
            if(kunnr.split(",").length>1){
                var  kunnrArray = kunnr.split(",");
                kunnrstring = ""
                
                for(var count = 0 ; count <kunnrArray.length ; count++){
                    if(count === kunnrArray.length -1){
                        kunnrstring =kunnrstring + " kunnr eq '" + kunnrArray[count].trim().padStart(10, '0') + "'";
                    }else {
                        kunnrstring =kunnrstring + " kunnr eq '" + kunnrArray[count].trim().padStart(10, '0') + "' or ";
                    }
                }
            }else if(kunnr.trim().length !== 10){
                kunnr = String(kunnr.trim()).padStart(10, '0');
                var kunnrstring ="kunnr eq '" + kunnr + "'";
            }
            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZCSD_ZKNMTRequest?$filter=("+kunnrstring+") and vkorg eq '" + salesorg + "'";
            
            this.getView().setBusy(true);
            
            this._makeRequest(sUrl, {
                method: 'GET'
            })
            .then(function(response) {
                that.getView().setBusy(false);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(function(oData) {
                var aItems = [];
                
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
                
                var oAnalytics = that._calculateAnalytics(aItems);
                
                var oListDataModel = that.getOwnerComponent().getModel("listData");
                oListDataModel.setData({ 
                    items: {
                        data: aItems,
                        length: aItems.length
                    },
                    analytics: oAnalytics
                });
                
                MessageToast.show("Data loaded successfully. " + aItems.length + " records found.");
            })
            .catch(function(error) {
                that.getView().setBusy(false);
                console.error("Request failed:", error);
                MessageBox.error("Error loading data. Please check your connection.");
            });
        },

        _calculateAnalytics: function(aItems) {
            var oAnalytics = {
                total: aItems.length,
                pending: 0,
                accepted: 0,
                rejected: 0,
                archived: 0
            };
            
            aItems.forEach(function(item) {
                // Check if archived (transaction type X)
                if (item.trtyp === 'X') {
                    oAnalytics.archived++;
                }
                // Check status
                if (item.status === 'P') {
                    oAnalytics.pending++;
                } else if (item.status === 'A') {
                    oAnalytics.accepted++;
                } else if (item.status === 'R') {
                    oAnalytics.rejected++;
                }
            });
            
            return oAnalytics;
        },

        // ==================== TAB HANDLING ====================
        
        onTabSelect: function(oEvent) {
            var sKey = oEvent.getParameter("key");
            console.log("Tab selected:", sKey);
            
            // Show/hide appropriate filter panels
            var oRequestsFilterPanel = this.byId("requestsFilterPanel");
            var oProcessedFilterPanel = this.byId("processedFilterPanel");
            
            if (sKey === "requests") {
                oRequestsFilterPanel.setVisible(true);
                oProcessedFilterPanel.setVisible(false);
            } else if (sKey === "processed") {
                oRequestsFilterPanel.setVisible(false);
                oProcessedFilterPanel.setVisible(true);
                
                // Load processed data if not already loaded
                var oProcessedDataModel = this.getView().getModel("processedData");
                if (!oProcessedDataModel.getProperty("/items") || oProcessedDataModel.getProperty("/items").length === 0) {
                    this._loadProcessedData();
                }
            }
        },

        _loadProcessedData: function() {
            var that = this;
            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZRSD_CustomerMaterialItem?$filter=Customer eq '6103000' and SalesOrganization eq '3000'";
            
            this.getView().setBusy(true);
            
            this._makeRequest(sUrl, {
                method: 'GET'
            })
            .then(function(response) {
                that.getView().setBusy(false);
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(function(oData) {
                var aItems = [];
                
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
                
                console.log("Loaded processed items count:", aItems.length);
                
                var oProcessedDataModel = that.getView().getModel("processedData");
                oProcessedDataModel.setData({ 
                    items: aItems,
                    count: aItems.length
                });
                
                MessageToast.show("Processed data loaded successfully. " + aItems.length + " records found.");
            })
            .catch(function(error) {
                that.getView().setBusy(false);
                console.error("Request failed:", error);
                MessageBox.error("Error loading processed data. Please check your connection.");
            });
        },

        // ==================== PROCESSED TABLE SEARCH & FILTERS ====================
        
        onProcessedQuickSearch: function(oEvent) {
            var sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue");
            var oTable = this.byId("processedTable");
            var oBinding = oTable.getBinding("items");
            
            if (!oBinding) {
                return;
            }
            
            var aFilters = [];
            
            if (sQuery && sQuery.length > 0) {
                var aQuickFilters = [
                    new Filter("Customer", FilterOperator.Contains, sQuery),
                    new Filter("SalesOrganization", FilterOperator.Contains, sQuery),
                    new Filter("Material", FilterOperator.Contains, sQuery),
                    new Filter("CustomerMaterial", FilterOperator.Contains, sQuery),
                    new Filter("CustomerMaterialDescription", FilterOperator.Contains, sQuery),
                    new Filter("CustomerUPC", FilterOperator.Contains, sQuery),
                    new Filter("BDRSUB", FilterOperator.Contains, sQuery),
                    new Filter("Department", FilterOperator.Contains, sQuery),
                    new Filter("MaterialUsage", FilterOperator.Contains, sQuery),
                    new Filter("CustomerLocation", FilterOperator.Contains, sQuery),
                    new Filter("OldMaterial", FilterOperator.Contains, sQuery)
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

        onProcessedSearch: function() {
            var oTable = this.byId("processedTable");
            var oBinding = oTable.getBinding("items");
            
            if (!oBinding) {
                MessageBox.warning("No data to search");
                return;
            }
            
            var aFilters = [];

            var sCustomer = this.byId("filterProcessedCustomer").getValue();
            var sSalesOrg = this.byId("filterProcessedSalesOrg").getValue();
            var sMaterial = this.byId("filterProcessedMaterial").getValue();
            var sCustomerMaterial = this.byId("filterProcessedCustomerMaterial").getValue();
            var sDescription = this.byId("filterProcessedDescription").getValue();
            var sUPC = this.byId("filterProcessedUPC").getValue();
            var sBDRSUB = this.byId("filterProcessedBDRSUB").getValue();
            var sDepartment = this.byId("filterProcessedDepartment").getValue();
            var sMaterialUsage = this.byId("filterProcessedMaterialUsage").getValue();
            var sLocation = this.byId("filterProcessedLocation").getValue();

            if (sCustomer) aFilters.push(new Filter("Customer", FilterOperator.Contains, sCustomer));
            if (sSalesOrg) aFilters.push(new Filter("SalesOrganization", FilterOperator.Contains, sSalesOrg));
            if (sMaterial) aFilters.push(new Filter("Material", FilterOperator.Contains, sMaterial));
            if (sCustomerMaterial) aFilters.push(new Filter("CustomerMaterial", FilterOperator.Contains, sCustomerMaterial));
            if (sDescription) aFilters.push(new Filter("CustomerMaterialDescription", FilterOperator.Contains, sDescription));
            if (sUPC) aFilters.push(new Filter("CustomerUPC", FilterOperator.Contains, sUPC));
            if (sBDRSUB) aFilters.push(new Filter("BDRSUB", FilterOperator.Contains, sBDRSUB));
            if (sDepartment) aFilters.push(new Filter("Department", FilterOperator.Contains, sDepartment));
            if (sMaterialUsage) aFilters.push(new Filter("MaterialUsage", FilterOperator.Contains, sMaterialUsage));
            if (sLocation) aFilters.push(new Filter("CustomerLocation", FilterOperator.Contains, sLocation));

            oBinding.filter(aFilters);
            
            var iCount = oBinding.getLength();
            MessageToast.show(iCount + " records found");
        },

        onProcessedReset: function() {
            this.byId("filterProcessedCustomer").setValue("");
            this.byId("filterProcessedSalesOrg").setValue("");
            this.byId("filterProcessedMaterial").setValue("");
            this.byId("filterProcessedCustomerMaterial").setValue("");
            this.byId("filterProcessedDescription").setValue("");
            this.byId("filterProcessedUPC").setValue("");
            this.byId("filterProcessedBDRSUB").setValue("");
            this.byId("filterProcessedDepartment").setValue("");
            this.byId("filterProcessedMaterialUsage").setValue("");
            this.byId("filterProcessedLocation").setValue("");
            
            var oSearchField = this.byId("processedSearchField");
            if (oSearchField) {
                oSearchField.setValue("");
            }
            
            var oTable = this.byId("processedTable");
            var oBinding = oTable.getBinding("items");
            if (oBinding) {
                oBinding.filter([]);
            }
            
            MessageToast.show("Filters cleared");
        },

        onProcessedItemPress: function(oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("processedData");
            
            if (!oContext) {
                MessageBox.error("Unable to get item context");
                return;
            }
            
            var oData = oContext.getObject();
            console.log("Processed item data:", oData);
            
            // Show details in a dialog
            MessageBox.information(
                "Customer: " + oData.Customer + "\n" +
                "Customer Name: " + (oData.CustomerName || "") + "\n" +
                "Sales Org: " + oData.SalesOrganization + "\n" +
                "Material: " + oData.Material + "\n" +
                "Customer Material: " + oData.CustomerMaterial + "\n" +
                "Description: " + (oData.CustomerMaterialDescription || "") + "\n" +
                "UPC: " + (oData.CustomerUPC || "") + "\n" +
                "Pack: " + (oData.CustomerPack || "") + "\n" +
                "BDR SUB: " + (oData.BDRSUB || "") + "\n" +
                "Department: " + (oData.Department || "") + "\n" +
                "Usage: " + (oData.MaterialUsage || "") + "\n" +
                "Location: " + (oData.CustomerLocation || ""),
                {
                    title: "Processed Request Details"
                }
            );
        },

        // ==================== REQUESTS TABLE (ORIGINAL) ====================

        onTilePress: function(oEvent) {
            var oTile = oEvent.getSource();
            var sStatus = oTile.data("status");
            var sTransactionType = oTile.data("transactionType");
            
            console.log("Tile pressed with status:", sStatus, "Transaction Type:", sTransactionType);
            
            // Clear all filters
            this.byId("filterKunnr").setValue("");
            this.byId("filterVkorg").setValue("");
            this.byId("filterKdmat").setValue("");
            this.byId("filterPostx").setValue("");
            this.byId("filterZzean11").setValue("");
            this.byId("filterZzloc").setValue("");
            this.byId("filterErnam").setValue("");
            this.byId("filterCreatedDate").setValue(null);
            this.byId("filterChangedDate").setValue(null);
            this.byId("filterStatus").setSelectedKey("");
            
            // Check if filtering by archived (transaction type X)
            if (sTransactionType === "X") {
                // Filter by transaction type X (archived)
                var oTable = this.byId("requestTable");
                var oBinding = oTable.getBinding("items");
                
                if (oBinding) {
                    var aFilters = [new Filter("trtyp", FilterOperator.EQ, "X")];
                    oBinding.filter(aFilters);
                }
                
                MessageToast.show("Showing archived requests (Transaction Type X)");
            } else if (sStatus === "ALL") {
                // Show all requests
                var oTable = this.byId("requestTable");
                var oBinding = oTable.getBinding("items");
                
                if (oBinding) {
                    oBinding.filter([]);
                }
                
                MessageToast.show("Showing all requests");
            } else {
                // Filter by status
                this.byId("filterStatus").setSelectedKey(sStatus);
                var sStatusText = sStatus === 'P' ? 'Pending' : sStatus === 'A' ? 'Accepted' : 'Rejected';
                MessageToast.show("Filtered by: " + sStatusText);
                this.onSearch();
            }
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
                var timestamp = parseInt(sDate.match(/\d+/)[0]);
                var oDate = new Date(sDate);
                
                var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                    pattern: "MMM dd, yyyy"
                });
                
                return oDateFormat.format(oDate);
            } catch(e) {
                return "";
            }
        },

        _parseSAPDate: function(sDate) {
            if (!sDate) return null;
            try {
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

            var sKunnr = this.byId("filterKunnr").getValue();
            var sVkorg = this.byId("filterVkorg").getValue();
            var sStatus = this.byId("filterStatus").getSelectedKey();
            var sTransactionType = this.byId("filterTransactionType").getSelectedKey();
            var sKdmat = this.byId("filterKdmat").getValue();
            var sPostx = this.byId("filterPostx").getValue();
            var sZzean11 = this.byId("filterZzean11").getValue();
            var sZzloc = this.byId("filterZzloc").getValue();
            var sErnam = this.byId("filterErnam").getValue();

            if (sKunnr) aFilters.push(new Filter("kunnr", FilterOperator.Contains, sKunnr));
            if (sVkorg) aFilters.push(new Filter("vkorg", FilterOperator.Contains, sVkorg));
            if (sStatus) aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            if (sTransactionType) aFilters.push(new Filter("trtyp", FilterOperator.EQ, sTransactionType));
            if (sKdmat) aFilters.push(new Filter("kdmat", FilterOperator.Contains, sKdmat));
            if (sPostx) aFilters.push(new Filter("postx", FilterOperator.Contains, sPostx));
            if (sZzean11) aFilters.push(new Filter("zzean11", FilterOperator.Contains, sZzean11));
            if (sZzloc) aFilters.push(new Filter("zzloc", FilterOperator.Contains, sZzloc));
            if (sErnam) aFilters.push(new Filter("ernam", FilterOperator.Contains, sErnam));
            
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
            this.byId("filterTransactionType").setSelectedKey("");
            this.byId("filterKdmat").setValue("");
            this.byId("filterPostx").setValue("");
            this.byId("filterZzean11").setValue("");
            this.byId("filterZzloc").setValue("");
            this.byId("filterErnam").setValue("");
            
            this.byId("filterCreatedDate").setValue(null);
            this.byId("filterChangedDate").setValue(null);
            
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
            var oTabBar = this.byId("tabBar");
            var sSelectedKey = oTabBar.getSelectedKey();
            
            if (sSelectedKey === "requests") {
                this.onReset();
                this._loadData(that.entitlements.salesOrg,that.entitlements.customer);
            } else if (sSelectedKey === "processed") {
                this.onProcessedReset();
                this._loadProcessedData();
            }
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

        // ==================== EXPORT FUNCTIONS ====================

        onExportToExcel: function() {
            // Check if SheetJS library is loaded
            if (typeof XLSX === 'undefined') {
                MessageBox.error(
                    "Excel export library is loading. Please try again in a moment.",
                    {
                        details: "If the problem persists, please refresh the page.",
                        actions: [MessageBox.Action.OK]
                    }
                );
                // Try to load it again
                this._loadSheetJSLibrary();
                return;
            }
            
            var oTabBar = this.byId("tabBar");
            var sSelectedKey = oTabBar.getSelectedKey();
            
            if (sSelectedKey === "requests") {
                this._exportRequestsToExcel();
            } else if (sSelectedKey === "processed") {
                this._exportProcessedToExcel();
            }
        },

        _exportRequestsToExcel: function() {
            var oTable = this.byId("requestTable");
            var oBinding = oTable.getBinding("items");
            
            if (!oBinding || oBinding.getLength() === 0) {
                MessageBox.warning("No data available to export");
                return;
            }
            
            // Get all data from binding
            var aData = [];
            var aContexts = oBinding.getContexts();
            aContexts.forEach(function(oContext) {
                aData.push(oContext.getObject());
            });
            
            // Prepare data for Excel
            var aExcelData = [];
            
            // Add header row
            aExcelData.push([
                'Customer',
                'Sales Org',
                'Material',
                'Description',
                'EAN',
                'UOM',
                'Location',
                'Status',
                'Created By',
                'Created Date',
                'Changed By',
                'Changed Date'
            ]);
            
            // Add data rows
            aData.forEach(function(oItem) {
                aExcelData.push([
                    oItem.kunnr || '',
                    oItem.vkorg || '',
                    oItem.kdmat || '',
                    oItem.postx || '',
                    oItem.zzean11 || '',
                    oItem.zzuom || '',
                    oItem.zzloc || '',
                    this._getStatusText(oItem.status),
                    oItem.ernam || '',
                    this._formatDateForExcel(oItem.createdatetime),
                    oItem.last_changed_by_user || '',
                    this._formatDateForExcel(oItem.changedatetime)
                ]);
            }.bind(this));
            
            // Create workbook and worksheet
            var wb = XLSX.utils.book_new();
            var ws = XLSX.utils.aoa_to_sheet(aExcelData);
            
            // Set column widths
            var colWidths = [
                {wch: 12}, // Customer
                {wch: 10}, // Sales Org
                {wch: 15}, // Material
                {wch: 30}, // Description
                {wch: 15}, // EAN
                {wch: 8},  // UOM
                {wch: 12}, // Location
                {wch: 10}, // Status
                {wch: 15}, // Created By
                {wch: 12}, // Created Date
                {wch: 15}, // Changed By
                {wch: 12}  // Changed Date
            ];
            ws['!cols'] = colWidths;
            
            // Apply header styling (if supported by the Excel application)
            var range = XLSX.utils.decode_range(ws['!ref']);
            for (var C = range.s.c; C <= range.e.c; ++C) {
                var address = XLSX.utils.encode_col(C) + "1";
                if (!ws[address]) continue;
                ws[address].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "CCCCCC" } }
                };
            }
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, "Requests");
            
            // Generate filename with timestamp
            var sFileName = "Requests_" + this._getTimestamp() + ".xlsx";
            
            // Save the file
            XLSX.writeFile(wb, sFileName);
            
            MessageToast.show("Excel export completed successfully!");
        },

        _formatDateForExcel: function(sDate) {
            if (!sDate) return '';
            
            var oDate;
            if (typeof sDate === 'string') {
                oDate = new Date(sDate);
                var dateString = sDate;
                var timestamp = parseInt(dateString.match(/\d+/)[0]);
                oDate = new Date(timestamp);
            } else if (sDate instanceof Date) {
                oDate = sDate;
            } else {
                return sDate;
            }
            
            if (isNaN(oDate.getTime())) {
                return sDate;
            }
            
            // Format as MM/DD/YYYY for Excel
            var sMonth = ('0' + (oDate.getMonth() + 1)).slice(-2);
            var sDay = ('0' + oDate.getDate()).slice(-2);
            var sYear = oDate.getFullYear();
            
            return sMonth + '/' + sDay + '/' + sYear;
        },

        _getStatusText: function(sStatus) {
            switch(sStatus) {
                case 'P': return 'Pending';
                case 'A': return 'Accepted';
                case 'R': return 'Rejected';
                case 'X': return 'Archived';
                default: return sStatus || '';
            }
        },

        _exportProcessedToExcel: function() {
            var oTable = this.byId("processedTable");
            var oBinding = oTable.getBinding("items");
            
            if (!oBinding || oBinding.getLength() === 0) {
                MessageBox.warning("No data available to export");
                return;
            }
            
            // Get all data from binding
            var aData = [];
            var aContexts = oBinding.getContexts();
            aContexts.forEach(function(oContext) {
                aData.push(oContext.getObject());
            });
            
            // Prepare data for Excel
            var aExcelData = [];
            
            // Add header row
            aExcelData.push([
                'Customer',
                'Sales Org',
                'Material',
                'Customer Material',
                'Description',
                'Customer UPC',
                'Pack',
                'BDR SUB',
                'Department',
                'Material Usage',
                'Location'
            ]);
            
            // Add data rows
            aData.forEach(function(oItem) {
                aExcelData.push([
                    oItem.Customer || '',
                    oItem.SalesOrganization || '',
                    oItem.Material || '',
                    oItem.CustomerMaterial || '',
                    oItem.CustomerMaterialDescription || '',
                    oItem.CustomerUPC || '',
                    oItem.CustomerPack || '',
                    oItem.BDRSUB || '',
                    oItem.Department || '',
                    oItem.MaterialUsage || '',
                    oItem.CustomerLocation || ''
                ]);
            });
            
            // Create workbook and worksheet
            var wb = XLSX.utils.book_new();
            var ws = XLSX.utils.aoa_to_sheet(aExcelData);
            
            // Set column widths
            var colWidths = [
                {wch: 12}, // Customer
                {wch: 10}, // Sales Org
                {wch: 15}, // Material
                {wch: 18}, // Customer Material
                {wch: 30}, // Description
                {wch: 15}, // Customer UPC
                {wch: 10}, // Pack
                {wch: 12}, // BDR SUB
                {wch: 15}, // Department
                {wch: 15}, // Material Usage
                {wch: 12}  // Location
            ];
            ws['!cols'] = colWidths;
            
            // Apply header styling
            var range = XLSX.utils.decode_range(ws['!ref']);
            for (var C = range.s.c; C <= range.e.c; ++C) {
                var address = XLSX.utils.encode_col(C) + "1";
                if (!ws[address]) continue;
                ws[address].s = {
                    font: { bold: true },
                    fill: { fgColor: { rgb: "CCCCCC" } }
                };
            }
            
            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, "Processed Requests");
            
            // Generate filename with timestamp
            var sFileName = "ProcessedRequests_" + this._getTimestamp() + ".xlsx";
            
            // Save the file
            XLSX.writeFile(wb, sFileName);
            
            MessageToast.show("Excel export completed successfully!");
        },

        // Helper method to get timestamp for filename
        _getTimestamp: function() {
            var oDate = new Date();
            var sYear = oDate.getFullYear();
            var sMonth = ('0' + (oDate.getMonth() + 1)).slice(-2);
            var sDay = ('0' + oDate.getDate()).slice(-2);
            var sHours = ('0' + oDate.getHours()).slice(-2);
            var sMinutes = ('0' + oDate.getMinutes()).slice(-2);
            
            return sYear + sMonth + sDay + '_' + sHours + sMinutes;
        },

        _convertToExcelCSV: function(aData) {
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
            var oTabBar = this.byId("tabBar");
            var sSelectedKey = oTabBar.getSelectedKey();
            
            if (sSelectedKey === "requests") {
                this._exportRequestsToCSV();
            } else if (sSelectedKey === "processed") {
                this._exportProcessedToCSV();
            }
        },

        _exportRequestsToCSV: function() {
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
            this._downloadFile(sCSV, 'Requests_' + new Date().getTime() + '.csv', 'text/csv;charset=utf-8;');
            
            MessageToast.show("CSV export completed");
        },

        _exportProcessedToCSV: function() {
            var oTable = this.byId("processedTable");
            var oBinding = oTable.getBinding("items");
            
            if (!oBinding || oBinding.getLength() === 0) {
                MessageBox.warning("No data available to export");
                return;
            }
            
            var aData = oBinding.getContexts().map(function(oContext) {
                return oContext.getObject();
            });
            
            var aHeaders = ['Customer', 'Sales Org', 'Material', 'Customer Material', 'Description', 'UPC', 'Pack', 'BDR SUB', 'Department', 'Usage', 'Location'];
            var sCSV = aHeaders.join(',') + '\n';
            
            aData.forEach(function(oItem) {
                var aRow = [
                    this._escapeCSV(oItem.Customer),
                    this._escapeCSV(oItem.SalesOrganization),
                    this._escapeCSV(oItem.Material),
                    this._escapeCSV(oItem.CustomerMaterial),
                    this._escapeCSV(oItem.CustomerMaterialDescription),
                    this._escapeCSV(oItem.CustomerUPC),
                    this._escapeCSV(oItem.CustomerPack),
                    this._escapeCSV(oItem.BDRSUB),
                    this._escapeCSV(oItem.Department),
                    this._escapeCSV(oItem.MaterialUsage),
                    this._escapeCSV(oItem.CustomerLocation)
                ];
                sCSV += aRow.join(',') + '\n';
            }.bind(this));
            
            this._downloadFile(sCSV, 'ProcessedRequests_' + new Date().getTime() + '.csv', 'text/csv;charset=utf-8;');
            
            MessageToast.show("CSV export completed");
        },

        _convertToCSV: function(aData) {
            var aHeaders = ['Customer', 'Sales Org', 'Material', 'Description', 'EAN', 'UOM', 'BDR Sub', 'Status', 'Created By', 'Created Date', 'Changed By', 'Changed Date'];
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

        // ==================== CREATE DIALOG ====================
        
        onNavigateToCreate: function() {
            console.log("onNavigateToCreate called - opening dialog");
            this._openCreateDialog();
        },

        _openCreateDialog: function() {
            var oView = this.getView();
            var that = this;
            
            if (!this._pCreateDialog) {
                this._pCreateDialog = Fragment.load({
                    id: oView.getId(),
                    name: "knmtapp.view.CreateDialog",
                    controller: this
                }).then(function(oDialog) {
                    oView.addDependent(oDialog);
                    console.log("Create dialog loaded successfully");
                    return oDialog;
                }).catch(function(error) {
                    console.error("Error loading create dialog:", error);
                    MessageBox.error("Error loading create dialog: " + error.message);
                });
            }
            
            this._pCreateDialog.then(function(oDialog) {
                console.log("Opening create dialog");
                that._initializeCreateModel();
                that._preloadCreateMaterialUsageData();
                that._preloadCreateTransactionTypeData();
                oDialog.open();
            });
        },

        _openCreateDialogWithData: function(oSourceData) {
            var oView = this.getView();
            var that = this;
            
            if (!this._pCreateDialog) {
                this._pCreateDialog = Fragment.load({
                    id: oView.getId(),
                    name: "knmtapp.view.CreateDialog",
                    controller: this
                }).then(function(oDialog) {
                    oView.addDependent(oDialog);
                    console.log("Create dialog loaded successfully");
                    return oDialog;
                }).catch(function(error) {
                    console.error("Error loading create dialog:", error);
                    MessageBox.error("Error loading create dialog: " + error.message);
                });
            }
            
            this._pCreateDialog.then(function(oDialog) {
                console.log("Opening create dialog with copied data");
                that._initializeCreateModel();
                that._populateCreateFormWithCopyData(oSourceData);
                that._preloadCreateMaterialUsageData();
                
                if (oSourceData.kunnr && oSourceData.vkorg) {
                    that._preloadCreateLocationData(oSourceData.kunnr, oSourceData.vkorg);
                    that._preloadCreateDepartmentData(oSourceData.kunnr, oSourceData.vkorg);
                }
                
                oDialog.open();
            });
        },

        _populateCreateFormWithCopyData: function(oSourceData) {
            if (!this._oCreateModel) {
                return;
            }
            
            this._oCreateModel.setData({
                kunnr: oSourceData.kunnr ,
                vkorg: oSourceData.vkorg ,
                kdmat: oSourceData.kdmat,
                zzloc: oSourceData.zzloc || "",
                zzdepartment: oSourceData.zzdepartment || "",
                zzmaterialusage: oSourceData.zzmaterialusage || "",
                trtyp: oSourceData.trtyp || "H",
                zzean11: oSourceData.zzean11 || "",
                zzpack: oSourceData.zzpack || 1,
                zzuom: oSourceData.zzuom || "CS",
                zzpack_whse: oSourceData.zzpack_whse || 1,
                zzsize: oSourceData.zzsize || "",
                postx: oSourceData.postx || "",
                zzbdrsub: oSourceData.zzbdrsub || "",
                kunnrState: "None",
                kunnrStateText: "",
                vkorgState: "None",
                vkorgStateText: "",
                kdmatState: "None",
                kdmatStateText: ""
            });
            
            MessageToast.show("Record data copied. Please enter a new CIC number.");
        },

        getCookieName: function(cname) {
            const cookieString = document.cookie;
            const cookies = cookieString.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.startsWith(cname + '=')) {
                    return cookie.substring(cname.length + 1);
                }
            }
            return null;
        },

        getUserEmail: function() {
            try {
                var cookies = JSON.parse(decodeURIComponent(document.cookie.split(";").find(element => element.trim().split("porky_auth").length > 1).split("porky_auth=")[1])).email;
                return cookies;
            } catch (e) {
                return null;
            }
        },
        getSystem: function() {
            try {
                var cookies = JSON.parse(decodeURIComponent(document.cookie.split(";").find(element => element.trim().split("porky_auth").length > 1).split("porky_auth=")[1])).zsystem;
                return cookies;
            } catch (e) {
                return null;
            }
        },

        /**
         * Fetch user entitlements from SAP OData service via MCP server
         */
        fetchUserEntitlements: function() {
            return new Promise((resolve, reject) => {
                this.userEmail = this.getUserEmail();
                if (this.userEmail === null) {
                    sap.m.MessageBox.error("You are not authorized to view this");
                    return null;
                }
                var sServiceName = "ZODATA_ENTITLEMENT_SRV";
                var sEntitySetName = "zbsd_moe";
                var sUrl = "https://api.porky.com/sap/services/" + sServiceName + "/entities/" + sEntitySetName + "?$filter=SmtpAddr eq '" + this.userEmail + "'";
                
                this._makeRequest(sUrl, {
                    method: 'GET'
                })
                .then(function(response) {
                    if (!response.ok) {
                        return response.json().then(function(errorData) {
                            throw errorData;
                        });
                    }
                    return response.json();
                }.bind(this))
                .then(function(data) {
                    try {
                        var entitlements = this.parseEntitlementsMCPResponse(data);
                        resolve(entitlements);
                    } catch (error) {
                        console.error("Error parsing entitlements response:", error);
                        reject(error);
                    }
                }.bind(this))
                .catch(function(error) {
                    console.error("MCP entitlements fetch error:", error);
                    
                    var sMessage = "Error fetching user entitlements";
                    if (error.error) {
                        sMessage = error.error;
                    }
                    if (error.message) {
                        sMessage += ": " + error.message;
                    }
                    
                    reject(new Error(sMessage));
                });
            });
        },

        // ==================== LOCATION F4 & AUTO-SUGGEST ====================
        
        _preloadCreateLocationData: function(sKunnr, sVkorg) {
            var that = this;
            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZBSD_ZKNMTLocation?$filter=Customer eq '" + sKunnr + "' and SalesOrganization eq '" + sVkorg + "'";
            
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
                that._aCreateLocationCache = aLocations;
            })
            .catch(function(error) {
                console.error("Error preloading locations:", error);
            });
        },

        onCreateLocationSuggest: function(oEvent) {
            console.log("onCreateLocationSuggest called");
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("suggestValue");
            var oCreateModel = this._oCreateModel;
            
            console.log("Suggest value:", sValue);
            
            var sKunnr = oCreateModel.getProperty("/kunnr");
            var sVkorg = oCreateModel.getProperty("/vkorg");
            
            console.log("Customer:", sKunnr, "Sales Org:", sVkorg);
            
            if (!sKunnr || !sVkorg) {
                MessageToast.show("Please enter Customer and Sales Organization first");
                return;
            }
            
            if (!this._aCreateLocationCache) {
                console.log("Cache not loaded, loading now...");
                this._preloadCreateLocationData(sKunnr, sVkorg);
                setTimeout(function() {
                    if (this._aCreateLocationCache) {
                        this.onCreateLocationSuggest(oEvent);
                    }
                }.bind(this), 500);
                return;
            }

            console.log("Cache available, filtering...");
            console.log("Cache size:", this._aCreateLocationCache.length);
            
            var aSuggestions = this._aCreateLocationCache.filter(function(oLocation) {
                return oLocation.Location && oLocation.Location.toLowerCase().indexOf(sValue.toLowerCase()) !== -1;
            });

            console.log("Found suggestions:", aSuggestions.length);

            oInput.destroySuggestionItems();
            aSuggestions.forEach(function(oLocation) {
                oInput.addSuggestionItem(new sap.ui.core.Item({
                    key: oLocation.Location,
                    text: oLocation.Location
                }));
            });
        },

        onCreateLocationSelected: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sLocation = oSelectedItem.getText();
                this._oCreateModel.setProperty("/zzloc", sLocation);
            }
        },

        onCreateLocationValueHelp: function() {
            console.log("onCreateLocationValueHelp called");
            var that = this;
            var oCreateModel = this._oCreateModel;
            var sKunnr = oCreateModel.getProperty("/kunnr");
            var sVkorg = oCreateModel.getProperty("/vkorg");

            console.log("Customer:", sKunnr, "Sales Org:", sVkorg);

            if (!sKunnr || !sVkorg) {
                MessageBox.warning("Please enter Customer Number and Sales Organization first");
                return;
            }

            if (!this._oCreateLocationDialog) {
                console.log("Creating location dialog");
                this._oCreateLocationDialog = new sap.m.SelectDialog({
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
                            var sLocation =  oSelectedItem.getBindingContext().getObject().Location;
                            that._oCreateModel.setProperty("/zzloc", sLocation);
                        }
                    },
                    cancel: function() {
                        that._oCreateLocationDialog.destroy();
                        that._oCreateLocationDialog = null;
                    }
                });
            }

            console.log("Loading location data for dialog");
            this._loadCreateLocationDataForDialog(sKunnr, sVkorg);
        },

        _loadCreateLocationDataForDialog: function(sKunnr, sVkorg) {
            var that = this;
            
            if (this._aCreateLocationCache) {
                this._displayCreateLocationDialog(this._aCreateLocationCache);
                return;
            }

            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZBSD_ZKNMTLocation?$filter=Customer eq '" + sKunnr + "' and SalesOrganization eq '" + sVkorg + "'";
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

                if(Array.isArray(data)){
                    aLocations = data;
                }else
                if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                    var parsedData = JSON.parse(data.content[0].text);
                    if (parsedData && Array.isArray(parsedData.data)) {
                        aLocations = parsedData.data;
                    }
                }
                
                that._aCreateLocationCache = aLocations;
                that._displayCreateLocationDialog(aLocations);
            })
            .catch(function(error) {
                BusyIndicator.hide();
                MessageBox.error("Error loading locations: " + error.message);
            });
        },

        _displayCreateLocationDialog: function(aLocations) {
            var oLocationModel = new JSONModel(aLocations);
            this._oCreateLocationDialog.setModel(oLocationModel);
            
            this._oCreateLocationDialog.bindAggregation("items", {
                path: "/",
                template: new sap.m.StandardListItem({
                    title: "{Location}",
                })
            });
            
            this._oCreateLocationDialog.open();
        },

        // ==================== DEPARTMENT F4 & AUTO-SUGGEST ====================
        
        _preloadCreateDepartmentData: function(sKunnr, sVkorg) {
            var that = this;
            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZBSD_ZKNMTDepartment?$filter=Customer eq '" + sKunnr + "' and SalesOrganization eq '" + sVkorg + "'";
            
            this._makeRequest(sUrl, {
                method: 'GET'
            })
            .then(function(response) {
                return response.json();
            })
            .then(function(data) {
                var aDepartments = [];
                if(Array.isArray(data)){
                    data = aDepartments;
                }else
                if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                    var parsedData = JSON.parse(data.content[0].text);
                    if (parsedData && Array.isArray(parsedData.data)) {
                        aDepartments = parsedData.data;
                    }
                }
                that._aCreateDepartmentCache = aDepartments;
            })
            .catch(function(error) {
                console.error("Error preloading departments:", error);
            });
        },

        onCreateDepartmentSuggest: function(oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("suggestValue");
            var oCreateModel = this._oCreateModel;
            
            var sKunnr = oCreateModel.getProperty("/kunnr");
            var sVkorg = oCreateModel.getProperty("/vkorg");
            
            if (!sKunnr || !sVkorg) {
                MessageToast.show("Please enter Customer and Sales Organization first");
                return;
            }
            
            if (!this._aCreateDepartmentCache) {
                this._preloadCreateDepartmentData(sKunnr, sVkorg);
                return;
            }

            var aSuggestions = this._aCreateDepartmentCache.filter(function(oDept) {
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

        onCreateDepartmentSelected: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sDepartment = oSelectedItem.getText();
                this._oCreateModel.setProperty("/zzdepartment", sDepartment);
            }
        },

        onCreateDepartmentValueHelp: function() {
            var that = this;
            var oCreateModel = this._oCreateModel;
            var sKunnr = oCreateModel.getProperty("/kunnr");
            var sVkorg = oCreateModel.getProperty("/vkorg");

            if (!sKunnr || !sVkorg) {
                MessageBox.warning("Please enter Customer Number and Sales Organization first");
                return;
            }

            if (!this._oCreateDepartmentDialog) {
                this._oCreateDepartmentDialog = new sap.m.SelectDialog({
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
                            var sDepartment = oSelectedItem.getBindingContext().getObject().Department                            ;
                            that._oCreateModel.setProperty("/zzdepartment", sDepartment);
                        }
                    },
                    cancel: function() {
                        that._oCreateDepartmentDialog.destroy();
                        that._oCreateDepartmentDialog = null;
                    }
                });
            }

            this._loadCreateDepartmentDataForDialog(sKunnr, sVkorg);
        },

        _loadCreateDepartmentDataForDialog: function(sKunnr, sVkorg) {
            var that = this;
            
            if (this._aCreateDepartmentCache) {
                this._displayCreateDepartmentDialog(this._aCreateDepartmentCache);
                return;
            }

            var sUrl = "https://api.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZBSD_ZKNMTDepartment?$filter=Customer eq '" + sKunnr + "' and SalesOrganization eq '" + sVkorg + "'";
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
                if(Array.isArray(data)){
                    aDepartments = data;
                }else 
                if (data && data.content && Array.isArray(data.content) && data.content[0]) {
                    var parsedData = JSON.parse(data.content[0].text);
                    if (parsedData && Array.isArray(parsedData.data)) {
                        aDepartments = parsedData.data;
                    }
                }
                
                that._aCreateDepartmentCache = aDepartments;
                that._displayCreateDepartmentDialog(aDepartments);
            })
            .catch(function(error) {
                BusyIndicator.hide();
                MessageBox.error("Error loading departments: " + error.message);
            });
        },

        _displayCreateDepartmentDialog: function(aDepartments) {
            var oDepartmentModel = new JSONModel(aDepartments);
            this._oCreateDepartmentDialog.setModel(oDepartmentModel);
            
            this._oCreateDepartmentDialog.bindAggregation("items", {
                path: "/",
                template: new sap.m.StandardListItem({
                    title: "{Department}"
                })
            });
            
            this._oCreateDepartmentDialog.open();
        },

        // ==================== MATERIAL USAGE F4 & AUTO-SUGGEST ====================
        
        _preloadCreateMaterialUsageData: function() {
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
                that._aCreateMaterialUsageCache = aUsages;
            })
            .catch(function(error) {
                console.error("Error preloading material usage:", error);
            });
        },

        onCreateMaterialUsageSuggest: function(oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("suggestValue");
            
            if (!this._aCreateMaterialUsageCache) {
                return;
            }

            var aSuggestions = this._aCreateMaterialUsageCache.filter(function(oUsage) {
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

        onCreateMaterialUsageSelected: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sValue = oSelectedItem.getKey();
                this._oCreateModel.setProperty("/zzmaterialusage", sValue);
            }
        },

        onCreateMaterialUsageValueHelp: function() {
            var that = this;

            if (!this._oCreateMaterialUsageDialog) {
                this._oCreateMaterialUsageDialog = new sap.m.SelectDialog({
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
                            that._oCreateModel.setProperty("/zzmaterialusage", oSelectedItem.getBindingContext().getObject().Value);
                        }
                    },
                    cancel: function() {
                        that._oCreateMaterialUsageDialog.destroy();
                        that._oCreateMaterialUsageDialog = null;
                    }
                });
            }

            this._loadCreateMaterialUsageDataForDialog();
        },

        _loadCreateMaterialUsageDataForDialog: function() {
            var that = this;
            
            if (this._aCreateMaterialUsageCache) {
                this._displayCreateMaterialUsageDialog(this._aCreateMaterialUsageCache);
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
                
                that._aCreateMaterialUsageCache = aUsages;
                that._displayCreateMaterialUsageDialog(aUsages);
            })
            .catch(function(error) {
                BusyIndicator.hide();
                MessageBox.error("Error loading material usage options: " + error.message);
            });
        },

        _displayCreateMaterialUsageDialog: function(aUsages) {
            var oUsageModel = new JSONModel(aUsages);
            this._oCreateMaterialUsageDialog.setModel(oUsageModel);
            
            this._oCreateMaterialUsageDialog.bindAggregation("items", {
                path: "/",
                template: new sap.m.StandardListItem({
                    title: "{Description}"
                })
            });
            
            this._oCreateMaterialUsageDialog.open();
        },

        // ==================== TRANSACTION TYPE F4 & AUTO-SUGGEST ====================

        _preloadCreateTransactionTypeData: function() {
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
                that._aCreateTransactionTypeCache = aTransactionTypes;
            })
            .catch(function(error) {
                console.error("Error preloading transaction types:", error);
            });
        },

        onCreateTransactionTypeSuggest: function(oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oEvent.getParameter("suggestValue");
            
            if (!this._aCreateTransactionTypeCache) {
                return;
            }

            var aSuggestions = this._aCreateTransactionTypeCache.filter(function(oType) {
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

        onCreateTransactionTypeSelected: function(oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            if (oSelectedItem) {
                var sValue = oSelectedItem.getKey();
                this._oCreateModel.setProperty("/trtyp", sValue);
            }
        },

        onCreateTransactionTypeValueHelp: function() {
            var that = this;

            if (!this._oCreateTransactionTypeDialog) {
                this._oCreateTransactionTypeDialog = new sap.m.SelectDialog({
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
                            that._oCreateModel.setProperty("/trtyp", sValue);
                        }
                    },
                    cancel: function() {
                        that._oCreateTransactionTypeDialog.destroy();
                        that._oCreateTransactionTypeDialog = null;
                    }
                });
            }

            this._loadCreateTransactionTypeDataForDialog();
        },

        _loadCreateTransactionTypeDataForDialog: function() {
            var that = this;
            
            if (this._aCreateTransactionTypeCache) {
                this._displayCreateTransactionTypeDialog(this._aCreateTransactionTypeCache);
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
                
                that._aCreateTransactionTypeCache = aTransactionTypes;
                that._displayCreateTransactionTypeDialog(aTransactionTypes);
            })
            .catch(function(error) {
                BusyIndicator.hide();
                MessageBox.error("Error loading transaction types: " + error.message);
            });
        },

        _displayCreateTransactionTypeDialog: function(aTransactionTypes) {
            var oTransactionTypeModel = new JSONModel(aTransactionTypes);
            this._oCreateTransactionTypeDialog.setModel(oTransactionTypeModel);
            
            this._oCreateTransactionTypeDialog.bindAggregation("items", {
                path: "/",
                template: new sap.m.StandardListItem({
                    title: "{Value}",
                    description: "{Description}"
                })
            });
            
            this._oCreateTransactionTypeDialog.open();
        },

        _initializeCreateModel: function() {
            console.log("_initializeCreateModel called");
            if (!this._oCreateModel) {
                this._oCreateModel = new JSONModel({
                    kunnr: "6103000",
                    vkorg: "3000",
                    kdmat: "",
                    zzloc: "",
                    zzdepartment: "",
                    zzmaterialusage: "",
                    trtyp: "H",
                    zzean11: "",
                    zzpack: 1,
                    zzuom: "CS",
                    zzpack_whse: 1,
                    zzsize: "",
                    postx: "",
                    zzbdrsub: "",
                    kunnrState: "None",
                    kunnrStateText: "",
                    vkorgState: "None",
                    vkorgStateText: "",
                    kdmatState: "None",
                    kdmatStateText: ""
                });
                this.getView().setModel(this._oCreateModel, "createModel");
            } else {
                this._clearCreateForm();
            }
        },
        _clearCreateForm: function() {
            if (this._oCreateModel) {
                this._oCreateModel.setData({
                    kunnr: "6103000",
                    vkorg: "3000",
                    kdmat: "",
                    zzloc: "",
                    zzdepartment: "",
                    zzmaterialusage: "",
                    trtyp: "H",
                    zzean11: "",
                    zzpack: 1,
                    zzuom: "CS",
                    zzpack_whse: 1,
                    zzsize: "",
                    postx: "",
                    zzbdrsub: "",
                    kunnrState: "None",
                    kunnrStateText: "",
                    vkorgState: "None",
                    vkorgStateText: "",
                    kdmatState: "None",
                    kdmatStateText: ""
                });
            }
        },

        onCreateSave: function() {
            console.log("onCreateSave called");
            if (!this._validateCreateForm()) {
                return;
            }

            var oCreateModel = this._oCreateModel;
            var oData = oCreateModel.getData();
            
            var oCreateData = {
                kunnr: oData.kunnr,
                vkorg: oData.vkorg,
                kdmat: oData.kdmat,
                zzloc: oData.zzloc,
                zzdepartment: oData.zzdepartment,
                zzmaterialusage: oData.zzmaterialusage,
                trtyp: oData.trtyp,
                zzean11: oData.zzean11,
                zzpack: parseInt(oData.zzpack) || 1,
                zzuom: oData.zzuom,
                zzpack_whse: parseInt(oData.zzpack_whse) || 1,
                zzsize: oData.zzsize,
                postx: oData.postx,
                zzbdrsub: oData.zzbdrsub
            };

            this.onCreateRequest(oCreateData);
        },
        _validateCreateForm: function() {
            var oCreateModel = this._oCreateModel;
            var oData = oCreateModel.getData();
            var bValid = true;

            // Reset all validation states
            oCreateModel.setProperty("/kunnrState", "None");
            oCreateModel.setProperty("/kunnrStateText", "");
            oCreateModel.setProperty("/vkorgState", "None");
            oCreateModel.setProperty("/vkorgStateText", "");
            oCreateModel.setProperty("/kdmatState", "None");
            oCreateModel.setProperty("/kdmatStateText", "");

            // Validate Customer Number
            if (!oData.kunnr || oData.kunnr.trim() === "") {
                oCreateModel.setProperty("/kunnrState", "Error");
                oCreateModel.setProperty("/kunnrStateText", "Customer Number is required");
                bValid = false;
            }

            // Validate Sales Organization
            if (!oData.vkorg || oData.vkorg.trim() === "") {
                oCreateModel.setProperty("/vkorgState", "Error");
                oCreateModel.setProperty("/vkorgStateText", "Sales Organization is required");
                bValid = false;
            }

            // Validate CIC Number
            if (!oData.kdmat || oData.kdmat.trim() === "") {
                oCreateModel.setProperty("/kdmatState", "Error");
                oCreateModel.setProperty("/kdmatStateText", "CIC Number is required");
                bValid = false;
            }

            if (!bValid) {
                MessageBox.error("Please fill in all required fields");
            }

            return bValid;
        },
        _clearCreateForm: function() {
            if (this._oCreateModel) {
                this._oCreateModel.setData({
                    kunnr: entitlements.customer,
                    vkorg: entitlements.salesOrg,
                    kdmat: "",
                    zzloc: "",
                    zzdepartment: "",
                    zzmaterialusage: "",
                    trtyp: "H",
                    zzean11: "",
                    zzpack: 1,
                    zzuom: "CS",
                    zzpack_whse: 1,
                    zzsize: "",
                    postx: "",
                    zzbdrsub: "",
                    kunnrState: "None",
                    kunnrStateText: "",
                    vkorgState: "None",
                    vkorgStateText: "",
                    kdmatState: "None",
                    kdmatStateText: ""
                });
            }
        },

        onCreateDialogClose: function() {
            console.log("onCreateDialogClose called");
            this._pCreateDialog.then(function(oDialog) {
                oDialog.close();
            });
        },

        _validateCreateForm: function() {
            var oCreateModel = this._oCreateModel;
            var oData = oCreateModel.getData();
            var bValid = true;

            // Reset all validation states
            oCreateModel.setProperty("/kunnrState", "None");
            oCreateModel.setProperty("/kunnrStateText", "");
            oCreateModel.setProperty("/vkorgState", "None");
            oCreateModel.setProperty("/vkorgStateText", "");
            oCreateModel.setProperty("/kdmatState", "None");
            oCreateModel.setProperty("/kdmatStateText", "");

            // Validate Customer Number
            if (!oData.kunnr || oData.kunnr.trim() === "") {
                oCreateModel.setProperty("/kunnrState", "Error");
                oCreateModel.setProperty("/kunnrStateText", "Customer Number is required");
                bValid = false;
            }

            // Validate Sales Organization
            if (!oData.vkorg || oData.vkorg.trim() === "") {
                oCreateModel.setProperty("/vkorgState", "Error");
                oCreateModel.setProperty("/vkorgStateText", "Sales Organization is required");
                bValid = false;
            }

            // Validate CIC Number
            if (!oData.kdmat || oData.kdmat.trim() === "") {
                oCreateModel.setProperty("/kdmatState", "Error");
                oCreateModel.setProperty("/kdmatStateText", "CIC Number is required");
                bValid = false;
            }

            if (!bValid) {
                MessageBox.error("Please fill in all required fields");
            }

            return bValid;
        },


        onCreateRequest: function() {
            var oCreateModel = this._oCreateModel;
            var oData = oCreateModel.getData();

            // Reset all validation states first
            oCreateModel.setProperty("/kunnrState", "None");
            oCreateModel.setProperty("/kunnrStateText", "");
            oCreateModel.setProperty("/vkorgState", "None");
            oCreateModel.setProperty("/vkorgStateText", "");
            oCreateModel.setProperty("/kdmatState", "None");
            oCreateModel.setProperty("/kdmatStateText", "");
            oCreateModel.setProperty("/postxState", "None");
            oCreateModel.setProperty("/postxStateText", "");
            oCreateModel.setProperty("/zzlocationState", "None");
            oCreateModel.setProperty("/zzlocationStateText", "");
            oCreateModel.setProperty("/zzdepartmentState", "None");
            oCreateModel.setProperty("/zzdepartmentStateText", "");
            oCreateModel.setProperty("/zzmaterialusageState", "None");
            oCreateModel.setProperty("/zzmaterialusageStateText", "");
            oCreateModel.setProperty("/zzean11State", "None");
            oCreateModel.setProperty("/zzean11StateText", "");
            oCreateModel.setProperty("/zzpackState", "None");
            oCreateModel.setProperty("/zzpackStateText", "");
            oCreateModel.setProperty("/zzuomState", "None");
            oCreateModel.setProperty("/zzuomStateText", "");
            oCreateModel.setProperty("/zzpack_whseState", "None");
            oCreateModel.setProperty("/zzpack_whseStateText", "");
            oCreateModel.setProperty("/zzsizeState", "None");
            oCreateModel.setProperty("/zzsizeStateText", "");

            var bValid = true;
            var aErrorMessages = [];

            // Customer Number validation
            if (!oData.kunnr || !oData.kunnr.trim()) {
                oCreateModel.setProperty("/kunnrState", "Error");
                oCreateModel.setProperty("/kunnrStateText", "Customer number is required");
                aErrorMessages.push("Customer number is required");
                bValid = false;
            }

            // Sales Organization validation
            if (!oData.vkorg || !oData.vkorg.trim()) {
                oCreateModel.setProperty("/vkorgState", "Error");
                oCreateModel.setProperty("/vkorgStateText", "Sales organization is required");
                aErrorMessages.push("Sales organization is required");
                bValid = false;
            }

            // CIC (Material Number) validation - must be 8 digits, all numeric
            if (!oData.kdmat || !oData.kdmat.trim()) {
                oCreateModel.setProperty("/kdmatState", "Error");
                oCreateModel.setProperty("/kdmatStateText", "CIC number is required");
                aErrorMessages.push("CIC number is required");
                bValid = false;
            } else {
                var sCIC = oData.kdmat.trim();
                var cicPattern = /^\d{8}$/;
                
                if (!cicPattern.test(sCIC)) {
                    oCreateModel.setProperty("/kdmatState", "Error");
                    if (!/^\d+$/.test(sCIC)) {
                        oCreateModel.setProperty("/kdmatStateText", "CIC must contain only numbers");
                        aErrorMessages.push("CIC must contain only numbers");
                    } else if (sCIC.length !== 8) {
                        oCreateModel.setProperty("/kdmatStateText", "CIC must be exactly 8 digits");
                        aErrorMessages.push("CIC must be exactly 8 digits (currently " + sCIC.length + " digits)");
                    } else {
                        oCreateModel.setProperty("/kdmatStateText", "CIC format is invalid");
                        aErrorMessages.push("CIC must be 8 numeric digits");
                    }
                    bValid = false;
                }
            }

            // Description validation
            if (!oData.postx || !oData.postx.trim()) {
                oCreateModel.setProperty("/postxState", "Error");
                oCreateModel.setProperty("/postxStateText", "Description is required");
                aErrorMessages.push("Description is required");
                bValid = false;
            }

            // Location validation
            if (!oData.zzloc || !oData.zzloc.trim()) {
                oCreateModel.setProperty("/zzlocationState", "Error");
                oCreateModel.setProperty("/zzlocationStateText", "BDR Sub is required");
                aErrorMessages.push("Location is required");
                bValid = false;
            }

            // Department validation
            if (!oData.zzdepartment || !oData.zzdepartment.trim()) {
                oCreateModel.setProperty("/zzdepartmentState", "Error");
                oCreateModel.setProperty("/zzdepartmentStateText", "Department is required");
                aErrorMessages.push("Department is required");
                bValid = false;
            }

            // Material Usage validation
            if (!oData.zzmaterialusage || !oData.zzmaterialusage.trim()) {
                oCreateModel.setProperty("/zzmaterialusageState", "Error");
                oCreateModel.setProperty("/zzmaterialusageStateText", "Usage is required");
                aErrorMessages.push("Usage is required");
                bValid = false;
            }

            // UPC validation - must be 12 digits and start with 0
            if (!oData.zzean11 || !oData.zzean11.trim()) {
                oCreateModel.setProperty("/zzean11State", "Error");
                oCreateModel.setProperty("/zzean11StateText", "UPC is required");
                aErrorMessages.push("UPC is required");
                bValid = false;
            } else {
                var sUPC = oData.zzean11.trim();
                var upcPattern = /^0\d{11}$/;
                
                if (!upcPattern.test(sUPC)) {
                    oCreateModel.setProperty("/zzean11State", "Error");
                    if (!/^\d+$/.test(sUPC)) {
                        oCreateModel.setProperty("/zzean11StateText", "UPC must contain only numbers");
                        aErrorMessages.push("UPC must contain only numbers");
                    } else if (!sUPC.startsWith("0")) {
                        oCreateModel.setProperty("/zzean11StateText", "UPC must start with 0");
                        aErrorMessages.push("UPC must start with 0");
                    } else if (sUPC.length !== 12) {
                        oCreateModel.setProperty("/zzean11StateText", "UPC must be exactly 12 digits");
                        aErrorMessages.push("UPC must be exactly 12 digits (currently " + sUPC.length + " digits)");
                    } else {
                        oCreateModel.setProperty("/zzean11StateText", "UPC format is invalid");
                        aErrorMessages.push("UPC must be 12 digits starting with 0");
                    }
                    bValid = false;
                }
            }

            // Pack validation
            if (!oData.zzpack || oData.zzpack <= 0) {
                oCreateModel.setProperty("/zzpackState", "Error");
                oCreateModel.setProperty("/zzpackStateText", "Pack must be greater than 0");
                aErrorMessages.push("Pack must be greater than 0");
                bValid = false;
            }

            // UOM validation
            if (!oData.zzuom || !oData.zzuom.trim()) {
                oCreateModel.setProperty("/zzuomState", "Error");
                oCreateModel.setProperty("/zzuomStateText", "UOM is required");
                aErrorMessages.push("UOM is required");
                bValid = false;
            }

            // Pack Warehouse validation
            if (!oData.zzpack_whse || oData.zzpack_whse <= 0) {
                oCreateModel.setProperty("/zzpack_whseState", "Error");
                oCreateModel.setProperty("/zzpack_whseStateText", "Pack Warehouse must be greater than 0");
                aErrorMessages.push("Pack Warehouse must be greater than 0");
                bValid = false;
            }

            // Size validation
            if (!oData.zzsize || !oData.zzsize.trim()) {
                oCreateModel.setProperty("/zzsizeState", "Error");
                oCreateModel.setProperty("/zzsizeStateText", "Size is required");
                aErrorMessages.push("Size is required");
                bValid = false;
            }

            if (!bValid) {
                var sErrorMessage = "Please fill all required fields:\n\n" + aErrorMessages.join("\n");
                MessageBox.error(sErrorMessage);
                return;
            }

            var that = this;
            var oView = this.getView();
            oView.setBusy(true);

            var oRequestData = {
                kunnr: oData.kunnr.trim(),
                vkorg: oData.vkorg.trim(),
                kdmat: oData.kdmat.trim(),
                zzloc: oData.zzloc.trim(),
                zzdepartment: oData.zzdepartment.trim(),
                zzmaterialusage: oData.zzmaterialusage.trim(),
                trtyp: oData.trtyp ? oData.trtyp.trim() : "H",
                zzean11: oData.zzean11.trim(),
                zzpack: oData.zzpack.toString(),
                zzuom: oData.zzuom.trim(),
                zzpack_whse: oData.zzpack_whse.toString(),
                zzsize: oData.zzsize.trim(),
                postx: oData.postx.trim(),
                zzbdrsub: oData.zzbdrsub ? oData.zzbdrsub.trim() : "",
                status: "P",
                statusText: "Pending",
                ernam: this.getOwnerComponent().getModel("currentUser") ? 
                       this.getOwnerComponent().getModel("currentUser").getData().email || "" : ""
            };

            var sServiceName = "ZODATA_KNMTREQUEST_SRV";
            var sEntitySetName = "ZCSD_ZKNMTRequest";
            var sUrl = "https://api.porky.com/sap/services/" + sServiceName + "/entities/" + sEntitySetName;
            
            this._makeRequest(sUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(oRequestData)
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

                if(data.content && data.content[0] && data.content[0].text) {
                    var parsedData = JSON.parse(data.content[0].text);
                    if(parsedData.data && parsedData.data.error) {
                        var sMessage = parsedData.data.error.message && parsedData.data.error.message.value 
                            ? parsedData.data.error.message.value 
                            : "An error occurred while creating the request";

                            if(sMessage.split("BDR SUB").length > 1) {
                                that.getView().byId("BDRSubCreateInput").setValueState("Error");
                                that.getView().byId("BDRSubCreateInput").setEditable(true);
                                return;
                            }
                        
                        if(parsedData.data.error.innererror && 
                           parsedData.data.error.innererror.errordetails && 
                           Array.isArray(parsedData.data.error.innererror.errordetails)) {
                            
                            var aErrorDetails = parsedData.data.error.innererror.errordetails;
                            that._resetFieldValidationStates();
                            
                            aErrorDetails.forEach(function(errorDetail) {
                                if(errorDetail.target && errorDetail.message) {
                                    var sFieldName = errorDetail.target.toLowerCase();
                                    var sFieldMessage = errorDetail.message;
                                    
                                    switch(sFieldName) {
                                        case "zzean11":
                                            oCreateModel.setProperty("/zzean11State", "Error");
                                            oCreateModel.setProperty("/zzean11StateText", sFieldMessage);
                                            break;
                                        case "kdmat":
                                            oCreateModel.setProperty("/kdmatState", "Error");
                                            oCreateModel.setProperty("/kdmatStateText", sFieldMessage);
                                            break;
                                        case "kunnr":
                                            oCreateModel.setProperty("/kunnrState", "Error");
                                            oCreateModel.setProperty("/kunnrStateText", sFieldMessage);
                                            break;
                                        case "vkorg":
                                            oCreateModel.setProperty("/vkorgState", "Error");
                                            oCreateModel.setProperty("/vkorgStateText", sFieldMessage);
                                            break;
                                        case "postx":
                                            oCreateModel.setProperty("/postxState", "Error");
                                            oCreateModel.setProperty("/postxStateText", sFieldMessage);
                                            break;
                                        case "zzloc":
                                            oCreateModel.setProperty("/zzlocationState", "Error");
                                            oCreateModel.setProperty("/zzlocationStateText", sFieldMessage);
                                            break;
                                        case "zzdepartment":
                                            oCreateModel.setProperty("/zzdepartmentState", "Error");
                                            oCreateModel.setProperty("/zzdepartmentStateText", sFieldMessage);
                                            break;
                                        case "zzmaterialusage":
                                            oCreateModel.setProperty("/zzmaterialusageState", "Error");
                                            oCreateModel.setProperty("/zzmaterialusageStateText", sFieldMessage);
                                            break;
                                        case "zzpack":
                                            oCreateModel.setProperty("/zzpackState", "Error");
                                            oCreateModel.setProperty("/zzpackStateText", sFieldMessage);
                                            break;
                                        case "zzuom":
                                            oCreateModel.setProperty("/zzuomState", "Error");
                                            oCreateModel.setProperty("/zzuomStateText", sFieldMessage);
                                            break;
                                        case "zzpack_whse":
                                            oCreateModel.setProperty("/zzpack_whseState", "Error");
                                            oCreateModel.setProperty("/zzpack_whseStateText", sFieldMessage);
                                            break;
                                        case "zzsize":
                                            oCreateModel.setProperty("/zzsizeState", "Error");
                                            oCreateModel.setProperty("/zzsizeStateText", sFieldMessage);
                                            break;
                                        case "zzbdrsub":
                                            oCreateModel.setProperty("/zzbdrsubState", "Error");
                                            oCreateModel.setProperty("/zzbdrsubStateText", sFieldMessage);
                                            break;
                                        case "trtyp":
                                            oCreateModel.setProperty("/trtypState", "Error");
                                            oCreateModel.setProperty("/trtypStateText", sFieldMessage);
                                            break;
                                        default:
                                            console.log("Unhandled error field:", sFieldName, sFieldMessage);
                                    }
                                }
                            });
                        }
                        
                        MessageBox.error(sMessage);
                        return;
                    }
                }
                
                MessageBox.success("Request submitted successfully", {
                    onClose: function() {
                        that._pCreateDialog.then(function(oDialog) {
                            oDialog.close();
                        });
                        that._loadData(that.entitlements.salesOrg,that.entitlements.customer);
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

        
    });
});