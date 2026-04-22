# AdminUpdateProductDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**brandCode** | **string** | 브랜드 코드 | [optional] [default to undefined]
**name** | **string** |  | [optional] [default to undefined]
**description** | **string** |  | [optional] [default to undefined]
**price** | **number** | 액면가 | [optional] [default to undefined]
**discountRate** | **number** | 판매 할인율 (%) | [optional] [default to undefined]
**tradeInRate** | **number** | 매입 할인율 (%) | [optional] [default to undefined]
**allowTradeIn** | **boolean** | 매입 허용 여부 | [optional] [default to undefined]
**isActive** | **boolean** | 활성화 여부 | [optional] [default to undefined]
**imageUrl** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { AdminUpdateProductDto } from './api';

const instance: AdminUpdateProductDto = {
    brandCode,
    name,
    description,
    price,
    discountRate,
    tradeInRate,
    allowTradeIn,
    isActive,
    imageUrl,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
