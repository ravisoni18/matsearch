sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator"
], function (Controller, MessageBox, BusyIndicator) {
    "use strict";

    return Controller.extend("knmtapp.controller.Create", {
        onInit: function () {
            // Initialize form with default values if needed
        },

        onNavBack: function() {
            this.getOwnerComponent().getRouter().navTo("list");
        },

        onSave: function() {
            var oView = this.getView();
            
            // Gather form data
            var oData = {
                kunnr: oView.byId("createKunnr").getValue(),
                vkorg: oView.byId("createVkorg").getValue(),
                kdmat: oView.byId("createKdmat").getValue(),
                zzloc: oView.byId("createZzloc").getValue(),
                zzdepartment: oView.byId("createZzdepartment").getValue(),
                zzmaterialusage: oView.byId("createZzmaterialusage").getSelectedKey(),
                zzean11: oView.byId("createZzean11").getValue(),
                zzpack: oView.byId("createZzpack").getValue().toString(),
                zzuom: oView.byId("createZzuom").getSelectedKey(),
                zzpack_whse: oView.byId("createZzpack_whse").getValue().toString(),
                zzsize: oView.byId("createZzsize").getValue().toString(),
                postx: oView.byId("createPostx").getValue(),
                zzbdrsub: oView.byId("createZzbdrsub").getValue(),
                status: "P" // Default to Pending
            };

            // Validation
            if (!oData.kunnr || !oData.vkorg || !oData.kdmat) {
                MessageBox.error("Please fill all required fields (Customer, Sales Org, Material)");
                
                // Set value states for required fields
                if (!oData.kunnr) oView.byId("createKunnr").setValueState("Error");
                if (!oData.vkorg) oView.byId("createVkorg").setValueState("Error");
                if (!oData.kdmat) oView.byId("createKdmat").setValueState("Error");
                
                return;
            }

            // Clear value states
            oView.byId("createKunnr").setValueState("None");
            oView.byId("createVkorg").setValueState("None");
            oView.byId("createKdmat").setValueState("None");

            BusyIndicator.show();
            var that = this;

            // Use MCP OData tool to create entity
            // You would call this through the MCP integration
            // For now, using a direct HTTP POST as fallback
            
            var sUrl = "https://mcp.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/entities/ZCSD_ZKNMTRequest";
            
            $.ajax({
                url: sUrl,
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify(oData),
                success: function(oResponse) {
                    BusyIndicator.hide();
                    MessageBox.success("KNMT Request created successfully", {
                        onClose: function() {
                            that._clearForm();
                            // Refresh the list data
                            var oListModel = that.getOwnerComponent().getModel("listData");
                            if (oListModel) {
                                // Trigger list refresh by navigating back
                                that.onNavBack();
                            }
                        }
                    });
                },
                error: function(oError) {
                    BusyIndicator.hide();
                    var sMessage = "Error creating request";
                    try {
                        if (oError.responseJSON && oError.responseJSON.error) {
                            sMessage = oError.responseJSON.error.message || sMessage;
                        }
                    } catch(e) {
                        console.error("Error parsing response:", e);
                    }
                    MessageBox.error(sMessage);
                }
            });
        },

        _clearForm: function() {
            var oView = this.getView();
            oView.byId("createKunnr").setValue("");
            oView.byId("createVkorg").setValue("");
            oView.byId("createKdmat").setValue("");
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
        }
    });
});