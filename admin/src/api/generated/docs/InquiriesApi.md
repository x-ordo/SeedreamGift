# InquiriesApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**inquiriesGet**](#inquiriesget) | **GET** /inquiries | 내 문의 목록 조회|
|[**inquiriesIdDelete**](#inquiriesiddelete) | **DELETE** /inquiries/{id} | 문의 삭제|
|[**inquiriesIdPatch**](#inquiriesidpatch) | **PATCH** /inquiries/{id} | 문의 수정|
|[**inquiriesPost**](#inquiriespost) | **POST** /inquiries | 문의 등록|

# **inquiriesGet**
> InternalApiHandlersAPIResponse inquiriesGet()


### Example

```typescript
import {
    InquiriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new InquiriesApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지당 항목 수 (optional) (default to 20)

const { status, data } = await apiInstance.inquiriesGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지당 항목 수 | (optional) defaults to 20|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**401** | Unauthorized |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **inquiriesIdDelete**
> InternalApiHandlersAPIResponse inquiriesIdDelete()


### Example

```typescript
import {
    InquiriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new InquiriesApi(configuration);

let id: number; //문의 ID (default to undefined)

const { status, data } = await apiInstance.inquiriesIdDelete(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 문의 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**401** | Unauthorized |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **inquiriesIdPatch**
> InternalApiHandlersAPIResponse inquiriesIdPatch(body)


### Example

```typescript
import {
    InquiriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new InquiriesApi(configuration);

let id: number; //문의 ID (default to undefined)
let body: object; //수정할 문의 내용

const { status, data } = await apiInstance.inquiriesIdPatch(
    id,
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 수정할 문의 내용 | |
| **id** | [**number**] | 문의 ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **inquiriesPost**
> InternalApiHandlersAPIResponse inquiriesPost(body)


### Example

```typescript
import {
    InquiriesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new InquiriesApi(configuration);

let body: object; //문의 내용 (category, subject, content 필수)

const { status, data } = await apiInstance.inquiriesPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **object**| 문의 내용 (category, subject, content 필수) | |


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

[BearerAuth](../README.md#BearerAuth)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**201** | Created |  -  |
|**400** | Bad Request |  -  |
|**401** | Unauthorized |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

