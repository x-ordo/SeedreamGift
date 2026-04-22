# CreateOrderDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**items** | [**Array&lt;OrderItemDto&gt;**](OrderItemDto.md) |  | [default to undefined]
**paymentMethod** | **string** | 결제 수단 | [optional] [default to undefined]
**giftReceiverEmail** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { CreateOrderDto } from './api';

const instance: CreateOrderDto = {
    items,
    paymentMethod,
    giftReceiverEmail,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
