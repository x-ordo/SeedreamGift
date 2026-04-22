# AdminCreateFaqDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**question** | **string** | FAQ 질문 | [default to undefined]
**answer** | **string** | FAQ 답변 | [default to undefined]
**category** | **string** | FAQ 카테고리 | [default to undefined]
**order** | **number** | 표시 순서 | [optional] [default to undefined]
**isActive** | **boolean** | 활성화 여부 | [optional] [default to undefined]

## Example

```typescript
import { AdminCreateFaqDto } from './api';

const instance: AdminCreateFaqDto = {
    question,
    answer,
    category,
    order,
    isActive,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
