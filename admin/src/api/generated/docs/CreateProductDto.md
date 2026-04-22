# CreateProductDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**brand** | **string** | 상품권 브랜드 | [default to undefined]
**name** | **string** |  | [default to undefined]
**description** | **string** |  | [optional] [default to undefined]
**price** | **number** | 액면가 | [default to undefined]
**discountRate** | **number** | 판매 할인율 (%) | [default to undefined]
**tradeInRate** | **number** | 매입 할인율 (%) | [default to undefined]
**allowTradeIn** | **boolean** |  | [optional] [default to undefined]
**imageUrl** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { CreateProductDto } from './api';

const instance: CreateProductDto = {
    brand,
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
