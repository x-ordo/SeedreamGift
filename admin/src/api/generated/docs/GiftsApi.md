# GiftsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**giftsCheckReceiverPost**](#giftscheckreceiverpost) | **POST** /gifts/check-receiver | 선물 수신자 확인|
|[**giftsIdClaimPost**](#giftsidclaimpost) | **POST** /gifts/{id}/claim | 선물 수령|
|[**giftsReceivedGet**](#giftsreceivedget) | **GET** /gifts/received | 받은 선물 목록 조회|
|[**giftsSearchGet**](#giftssearchget) | **GET** /gifts/search | 선물 수신자 검색|
|[**ordersMyGiftsGet**](#ordersmygiftsget) | **GET** /orders/my-gifts | 받은 선물 목록 조회|

# **giftsCheckReceiverPost**
> InternalApiHandlersAPIResponse giftsCheckReceiverPost(body)


### Example

```typescript
import {
    GiftsApi,
    Configuration,
    InternalApiHandlersCheckReceiverRequest
} from './api';

const configuration = new Configuration();
const apiInstance = new GiftsApi(configuration);

let body: InternalApiHandlersCheckReceiverRequest; //수신자 이메일

const { status, data } = await apiInstance.giftsCheckReceiverPost(
    body
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **body** | **InternalApiHandlersCheckReceiverRequest**| 수신자 이메일 | |


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **giftsIdClaimPost**
> InternalApiHandlersAPIResponse giftsIdClaimPost()


### Example

```typescript
import {
    GiftsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GiftsApi(configuration);

let id: number; //선물 ID (default to undefined)

const { status, data } = await apiInstance.giftsIdClaimPost(
    id
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **id** | [**number**] | 선물 ID | defaults to undefined|


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
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **giftsReceivedGet**
> InternalApiHandlersAPIResponse giftsReceivedGet()


### Example

```typescript
import {
    GiftsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GiftsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.giftsReceivedGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 크기 | (optional) defaults to 20|


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
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **giftsSearchGet**
> InternalApiHandlersAPIResponse giftsSearchGet()


### Example

```typescript
import {
    GiftsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GiftsApi(configuration);

let query: string; //이름 또는 이메일 검색어 (최소 3자) (default to undefined)

const { status, data } = await apiInstance.giftsSearchGet(
    query
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **query** | [**string**] | 이름 또는 이메일 검색어 (최소 3자) | defaults to undefined|


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
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **ordersMyGiftsGet**
> InternalApiHandlersAPIResponse ordersMyGiftsGet()


### Example

```typescript
import {
    GiftsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new GiftsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지 크기 (optional) (default to 20)

const { status, data } = await apiInstance.ordersMyGiftsGet(
    page,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **page** | [**number**] | 페이지 번호 | (optional) defaults to 1|
| **limit** | [**number**] | 페이지 크기 | (optional) defaults to 20|


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
|**400** | Bad Request |  -  |
|**500** | Internal Server Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

