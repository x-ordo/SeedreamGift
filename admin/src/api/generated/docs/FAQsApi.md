# FAQsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**faqsActiveGet**](#faqsactiveget) | **GET** /faqs/active | 활성 FAQ 목록 조회|
|[**faqsCategoriesGet**](#faqscategoriesget) | **GET** /faqs/categories | FAQ 카테고리 목록 조회|
|[**faqsGet**](#faqsget) | **GET** /faqs | FAQ 목록 조회|
|[**faqsIdGet**](#faqsidget) | **GET** /faqs/{id} | FAQ 단건 조회|
|[**faqsIdHelpfulPatch**](#faqsidhelpfulpatch) | **PATCH** /faqs/{id}/helpful | FAQ 도움됨 수 증가|

# **faqsActiveGet**
> InternalApiHandlersAPIResponse faqsActiveGet()


### Example

```typescript
import {
    FAQsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FAQsApi(configuration);

let category: string; //카테고리 필터 (optional) (default to undefined)

const { status, data } = await apiInstance.faqsActiveGet(
    category
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **category** | [**string**] | 카테고리 필터 | (optional) defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **faqsCategoriesGet**
> InternalApiHandlersAPIResponse faqsCategoriesGet()


### Example

```typescript
import {
    FAQsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FAQsApi(configuration);

const { status, data } = await apiInstance.faqsCategoriesGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **faqsGet**
> InternalApiHandlersAPIResponse faqsGet()


### Example

```typescript
import {
    FAQsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FAQsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지당 항목 수 (optional) (default to 20)
let category: string; //카테고리 필터 (optional) (default to undefined)

const { status, data } = await apiInstance.faqsGet(
    page,
    limit,
    category
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지당 항목 수 | (optional) defaults to 20|
| **category** | [**string**] | 카테고리 필터 | (optional) defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **faqsIdGet**
> InternalApiHandlersAPIResponse faqsIdGet()


### Example

```typescript
import {
    FAQsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FAQsApi(configuration);

let id: number; //FAQ ID (default to undefined)

const { status, data } = await apiInstance.faqsIdGet(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | FAQ ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**404** | Not Found |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **faqsIdHelpfulPatch**
> InternalApiHandlersAPIResponse faqsIdHelpfulPatch()


### Example

```typescript
import {
    FAQsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new FAQsApi(configuration);

let id: number; //FAQ ID (default to undefined)

const { status, data } = await apiInstance.faqsIdHelpfulPatch(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | FAQ ID | defaults to undefined|


### Return type

**InternalApiHandlersAPIResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | OK |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

