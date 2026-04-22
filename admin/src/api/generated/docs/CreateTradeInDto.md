# CreateTradeInDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**productId** | **number** | 상품 ID | [default to undefined]
**pinCode** | **string** | PIN 번호 (하이픈 포함 가능) | [default to undefined]
**bankName** | **string** | 은행명 | [default to undefined]
**accountNum** | **string** | 계좌번호 (숫자만) | [default to undefined]
**accountHolder** | **string** | 예금주명 | [default to undefined]

## Example

```typescript
import { CreateTradeInDto } from './api';

const instance: CreateTradeInDto = {
    productId,
    pinCode,
    bankName,
    accountNum,
    accountHolder,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
