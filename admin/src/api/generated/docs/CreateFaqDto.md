# CreateFaqDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**question** | **string** | FAQ 질문 | [default to undefined]
**answer** | **string** | FAQ 답변 (HTML/Text) | [default to undefined]
**category** | **string** | 카테고리 (GENERAL, PAYMENT, TRADE_IN, ACCOUNT, SHIPPING) | [default to undefined]
**order** | **number** | 정렬 순서 | [optional] [default to 99]
**isActive** | **boolean** | 활성화 여부 | [optional] [default to true]

## Example

```typescript
import { CreateFaqDto } from './api';

const instance: CreateFaqDto = {
    question,
    answer,
    category,
    order,
    isActive,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
