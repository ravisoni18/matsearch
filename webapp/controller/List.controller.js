sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"

], function (Controller, Filter, FilterOperator,JSONModel) {
    "use strict";

    return Controller.extend("knmtapp.controller.List", {
        onInit: function () {
            this._loadData();
        },
        _loadData: function() {
            var that = this;
            var sUrl = "https://mcp.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZCSD_ZKNMTRequest";
            
            this.getView().setBusy(true);
            var oModel = new JSONModel();
            oModel.loadData(sUrl);
            
            oModel.attachRequestCompleted(function(oEvent) {
                that.getView().setBusy(false);
                if (oEvent.getParameter("success")) {
                    var oData = oModel.getData();
                    var data = JSON.parse(oData.content[0].text);
                    if (data && data) {
                        oModel.setData({ items: data });
                    } else if (oData.value) {
                        oModel.setData({ items: oData.value });
                    } else if (Array.isArray(oData)) {
                        oModel.setData({ items: oData });
                    } else {
                        oModel.setData({ items: [] });
                    }
                    that.getView().setModel(oModel, "listData");
                } else {
                    MessageBox.error("Failed to load data from server");
                }
            });
            
            oModel.attachRequestFailed(function() {
                that.getView().setBusy(false);
                MessageBox.error("Error loading data. Please check your connection.");
            });
        },


        formatStatus: function(status) {
            if (status === 'P') return 'Warning';
            if (status === 'A') return 'Success';
            if (status === 'R') return 'Error';
            return 'None';
        },

        onSearch: function() {
            var oTable = this.byId("requestTable");
            var oBinding = oTable.getBinding("items");
            var aFilters = [];

            var sKunnr = this.byId("filterKunnr").getValue();
            var sVkorg = this.byId("filterVkorg").getValue();
            var sStatus = this.byId("filterStatus").getSelectedKey();
            var sKdmat = this.byId("filterKdmat").getValue();

            if (sKunnr) {
                aFilters.push(new Filter("kunnr", FilterOperator.Contains, sKunnr));
            }
            if (sVkorg) {
                aFilters.push(new Filter("vkorg", FilterOperator.Contains, sVkorg));
            }
            if (sStatus) {
                aFilters.push(new Filter("status", FilterOperator.EQ, sStatus));
            }
            if (sKdmat) {
                aFilters.push(new Filter("kdmat", FilterOperator.Contains, sKdmat));
            }

            oBinding.filter(aFilters);
        },

        onClear: function() {
            this.byId("filterKunnr").setValue("");
            this.byId("filterVkorg").setValue("");
            this.byId("filterStatus").setSelectedKey("");
            this.byId("filterKdmat").setValue("");
            this.onSearch();
        },

        onRefresh: function() {
            this.byId("requestTable").getBinding("items").refresh();
        },

        onNavigateToCreate: function() {
            this.getOwnerComponent().getRouter().navTo("create");
        }
    });
});
