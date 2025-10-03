sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/odata/v2/ODataModel",
    "sap/ui/model/json/JSONModel"
], function (UIComponent, ODataModel, JSONModel) {
    "use strict";

    return UIComponent.extend("knmtapp.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            
            // Create OData Model
            // var oModel = new ODataModel({
            //     serviceUrl: "https://mcp.porky.com/sap/services/ZODATA_KNMTREQUEST_SRV/",
            //     defaultBindingMode: "TwoWay"
            // });
            // this.setModel(oModel);
            
            // Create device model
            var oDeviceModel = new JSONModel(sap.ui.Device);
            oDeviceModel.setDefaultBindingMode("OneWay");
            this.setModel(oDeviceModel, "device");
            
             // Create empty listData model BEFORE router initialization
            var oListDataModel = new JSONModel({
                items: {
                    data: [],
                    length: 0
                }
            });
            this.setModel(oListDataModel, "listData");
  
            this.getRouter().initialize();
        }
    });
});
