# SiteConfigsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**siteConfigControllerFindAll**](#siteconfigcontrollerfindall) | **GET** /site-configs | 전체 설정 조회|
|[**siteConfigControllerFindOne**](#siteconfigcontrollerfindone) | **GET** /site-configs/{key} | 단일 설정 조회|
|[**siteConfigControllerUpdate**](#siteconfigcontrollerupdate) | **PATCH** /site-configs/{key} | 설정 값 변경 (관리자)|

# **siteConfigControllerFindAll**
> siteConfigControllerFindAll()


### Example

```typescript
import {
    SiteConfigsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SiteConfigsApi(configuration);

const { status, data } = await apiInstance.siteConfigControllerFindAll();
```

### Parameters
This endpoint does not have any parameters.


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **siteConfigControllerFindOne**
> siteConfigControllerFindOne()


### Example

```typescript
import {
    SiteConfigsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SiteConfigsApi(configuration);

let key: string; // (default to undefined)

const { status, data } = await apiInstance.siteConfigControllerFindOne(
    key
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **key** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **siteConfigControllerUpdate**
> siteConfigControllerUpdate()


### Example

```typescript
import {
    SiteConfigsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SiteConfigsApi(configuration);

let key: string; // (default to undefined)

const { status, data } = await apiInstance.siteConfigControllerUpdate(
    key
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **key** | [**string**] |  | defaults to undefined|


### Return type

void (empty response body)

### Authorization

[bearer](../README.md#bearer)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: Not defined


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

