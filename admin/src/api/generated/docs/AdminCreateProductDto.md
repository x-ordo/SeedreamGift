# AdminCreateProductDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**brandCode** | **string** | 브랜드 코드 | [default to undefined]
**name** | **string** |  | [default to undefined]
**description** | **string** |  | [optional] [default to undefined]
**price** | **number** | 액면가 | [default to undefined]
**discountRate** | **number** | 판매 할인율 (%) | [default to undefined]
**tradeInRate** | **number** | 매입 할인율 (%) | [default to undefined]
**allowTradeIn** | **boolean** | 매입 허용 여부 | [optional] [default to undefined]
**imageUrl** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { AdminCreateProductDto } from './api';

const instance: AdminCreateProductDto = {
    brandCode,
    name,
    description,
    price,
    discountRate,
    tradeInRate,
    allowTradeIn,
    imageUrl,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
