sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/core/BusyIndicator"
], function (Controller, MessageBox, BusyIndicator) {
    "use strict";

    return Controller.extend("knmtapp.controller.Create", {
        onInit: function () {
        },

        onNavBack: function() {
            this.getOwnerComponent().getRouter().navTo("list");
        },

        onSave: function() {
            var oView = this.getView();
            var oModel = this.getView().getModel();
            
            var oData = {
                kunnr: oView.byId("createKunnr").getValue(),
                vkorg: oView.byId("createVkorg").getValue(),
                kdmat: oView.byId("createKdmat").getValue(),
                zzloc: oView.byId("createZzloc").getValue(),
                zzdepartment: oView.byId("createZzdepartment").getValue(),
                zzmaterialusage: oView.byId("createZzmaterialusage").getValue(),
                zzean11: oView.byId("createZzean11").getValue(),
                zzpack: oView.byId("createZzpack").getValue(),
                zzuom: oView.byId("createZzuom").getValue(),
                zzpack_whse: oView.byId("createZzpack_whse").getValue(),
                zzsize: oView.byId("createZzsize").getValue(),
                postx: oView.byId("createPostx").getValue(),
                zzbdrsub: oView.byId("createZzbdrsub").getValue()
            };

            // Validation
            if (!oData.kunnr || !oData.vkorg || !oData.kdmat) {
                MessageBox.error("Please fill all required fields");
                return;
            }

            BusyIndicator.show();
            var that = this;

            oModel.create("/ZCSD_ZKNMTRequest", oData, {
                success: function() {
                    BusyIndicator.hide();
                    MessageBox.success("Request created successfully", {
                        onClose: function() {
                            that._clearForm();
                            that.onNavBack();
                        }
                    });
                },
                error: function(oError) {
                    BusyIndicator.hide();
                    var sMessage = "Error creating request";
                    try {
                        var oErrorResponse = JSON.parse(oError.responseText);
                        sMessage = oErrorResponse.error.message.value || sMessage;
                    } catch(e) {}
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
            oView.byId("createZzmaterialusage").setValue("");
            oView.byId("createZzean11").setValue("");
            oView.byId("createZzpack").setValue("");
            oView.byId("createZzuom").setValue("");
            oView.byId("createZzpack_whse").setValue("");
            oView.byId("createZzsize").setValue("");
            oView.byId("createPostx").setValue("");
            oView.byId("createZzbdrsub").setValue("");
        }
    });
});
