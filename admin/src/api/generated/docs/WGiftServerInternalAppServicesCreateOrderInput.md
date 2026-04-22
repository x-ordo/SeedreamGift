# WGiftServerInternalAppServicesCreateOrderInput


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**items** | [**Array&lt;WGiftServerInternalAppServicesCreateOrderInputItemsInner&gt;**](WGiftServerInternalAppServicesCreateOrderInputItemsInner.md) |  | [default to undefined]
**paymentMethod** | **string** |  | [optional] [default to undefined]
**recipientAddr** | **string** |  | [optional] [default to undefined]
**recipientName** | **string** |  | [optional] [default to undefined]
**recipientPhone** | **string** |  | [optional] [default to undefined]
**recipientZip** | **string** |  | [optional] [default to undefined]
**shippingMethod** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { WGiftServerInternalAppServicesCreateOrderInput } from './api';

const instance: WGiftServerInternalAppServicesCreateOrderInput = {
    items,
    paymentMethod,
    recipientAddr,
    recipientName,
    recipientPhone,
    recipientZip,
    shippingMethod,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
