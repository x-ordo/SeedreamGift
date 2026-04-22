# BrandsApi

All URIs are relative to *http://localhost:5140/api/v1*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**brandsCodeGet**](#brandscodeget) | **GET** /brands/{code} | 브랜드 단건 조회|
|[**brandsGet**](#brandsget) | **GET** /brands | 브랜드 목록 조회|

# **brandsCodeGet**
> InternalApiHandlersAPIResponse brandsCodeGet()


### Example

```typescript
import {
    BrandsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BrandsApi(configuration);

let code: string; //브랜드 코드 (default to undefined)

const { status, data } = await apiInstance.brandsCodeGet(
    code
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **code** | [**string**] | 브랜드 코드 | defaults to undefined|


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

# **brandsGet**
> InternalApiHandlersAPIResponse brandsGet()


### Example

```typescript
import {
    BrandsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new BrandsApi(configuration);

let page: number; //페이지 번호 (optional) (default to 1)
let limit: number; //페이지당 항목 수 (optional) (default to 20)

const { status, data } = await apiInstance.brandsGet(
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

No authorization required

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

