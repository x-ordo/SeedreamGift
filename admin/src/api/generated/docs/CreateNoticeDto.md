# CreateNoticeDto


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**title** | **string** | 공지사항 제목 | [default to undefined]
**content** | **string** | 공지사항 내용 (HTML/Text) | [default to undefined]
**isActive** | **boolean** | 활성화 여부 | [optional] [default to true]

## Example

```typescript
import { CreateNoticeDto } from './api';

const instance: CreateNoticeDto = {
    title,
    content,
    isActive,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
