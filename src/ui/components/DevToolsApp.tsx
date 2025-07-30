import React, { useState, useEffect } from 'react';
import { 
  Layout, 
  Card, 
  Table, 
  Button, 
  Space, 
  Typography, 
  Tag, 
  Input,
  Select,
  Modal,
  Form,
  Switch,
  message,
  Tooltip,
  Popconfirm
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  SettingOutlined,
  BugOutlined,
  GlobalOutlined,
  DownloadOutlined,
  UploadOutlined,
  RightOutlined
} from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

interface Rule {
  id: string;
  on: boolean;
  type: 'fileOverride' | 'urlRedirect' | 'headerModification' | 'contentModification';
  from: string;
  to?: string;
  file?: string;
  fileType?: 'js' | 'css' | 'html';
  description?: string;
}

interface Domain {
  id: string;
  url: string;
  on: boolean;
  rules: Rule[];
  description?: string;
}

const DevToolsApp: React.FC = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [currentDomainId, setCurrentDomainId] = useState<string>('');
  
  const [form] = Form.useForm();
  const [ruleForm] = Form.useForm();

  // 加载域名和规则
  useEffect(() => {
    loadDomains();
  }, []);

  const loadDomains = async (): Promise<void> => {
    setLoading(true);
    try {
      const result = await chrome.storage.local.get(['domains']);
      setDomains(result.domains || []);
    } catch (error) {
      console.error('Failed to load domains:', error);
      message.error('加载域名失败');
    } finally {
      setLoading(false);
    }
  };

  const saveDomains = async (newDomains: Domain[]): Promise<void> => {
    try {
      await chrome.storage.local.set({ domains: newDomains });
      setDomains(newDomains);
      message.success('保存成功');
    } catch (error) {
      console.error('Failed to save domains:', error);
      message.error('保存失败');
    }
  };

  const toggleDomain = async (domainId: string): Promise<void> => {
    const newDomains = domains.map(domain => 
      domain.id === domainId 
        ? { ...domain, on: !domain.on }
        : domain
    );
    await saveDomains(newDomains);
  };

  const toggleRule = async (domainId: string, ruleId: string): Promise<void> => {
    const newDomains = domains.map(domain => 
      domain.id === domainId 
        ? {
            ...domain,
            rules: domain.rules.map(rule =>
              rule.id === ruleId ? { ...rule, on: !rule.on } : rule
            )
          }
        : domain
    );
    await saveDomains(newDomains);
  };

  const deleteDomain = async (domainId: string): Promise<void> => {
    const newDomains = domains.filter(domain => domain.id !== domainId);
    await saveDomains(newDomains);
  };

  const deleteRule = async (domainId: string, ruleId: string): Promise<void> => {
    const newDomains = domains.map(domain => 
      domain.id === domainId 
        ? {
            ...domain,
            rules: domain.rules.filter(rule => rule.id !== ruleId)
          }
        : domain
    );
    await saveDomains(newDomains);
  };

  const openDomainModal = (domain?: Domain): void => {
    setEditingDomain(domain || null);
    if (domain) {
      form.setFieldsValue(domain);
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  const openRuleModal = (domainId: string, rule?: Rule): void => {
    setCurrentDomainId(domainId);
    setEditingRule(rule || null);
    if (rule) {
      ruleForm.setFieldsValue(rule);
    } else {
      ruleForm.resetFields();
    }
    setRuleModalVisible(true);
  };

  const handleDomainSubmit = async (values: any): Promise<void> => {
    try {
      if (editingDomain) {
        // 编辑域名
        const newDomains = domains.map(domain =>
          domain.id === editingDomain.id
            ? { ...domain, ...values }
            : domain
        );
        await saveDomains(newDomains);
      } else {
        // 新增域名
        const newDomain: Domain = {
          id: Date.now().toString(),
          ...values,
          rules: []
        };
        await saveDomains([...domains, newDomain]);
      }
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      message.error('保存域名失败');
    }
  };

  const handleRuleSubmit = async (values: any): Promise<void> => {
    try {
      const newRule: Rule = {
        id: editingRule?.id || Date.now().toString(),
        ...values
      };

      const newDomains = domains.map(domain =>
        domain.id === currentDomainId
          ? {
              ...domain,
              rules: editingRule
                ? domain.rules.map(rule => rule.id === editingRule.id ? newRule : rule)
                : [...domain.rules, newRule]
            }
          : domain
      );
      
      await saveDomains(newDomains);
      setRuleModalVisible(false);
      ruleForm.resetFields();
    } catch (error) {
      message.error('保存规则失败');
    }
  };

  // 导出规则
  const handleExportRules = (): void => {
    try {
      const exportData = {
        version: '1.0.0',
        exportTime: new Date().toISOString(),
        domains: domains
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `resource-override-rules-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      message.success('规则导出成功');
    } catch (error) {
      console.error('Export failed:', error);
      message.error('导出失败');
    }
  };

  // 导入规则
  const handleImportRules = (): void => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event: Event) => {
      const target = event.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        // 验证导入数据格式
        if (!importData.domains || !Array.isArray(importData.domains)) {
          throw new Error('Invalid import format');
        }

        // 显示确认对话框
        Modal.confirm({
          title: '确认导入规则',
          content: `确定要导入 ${importData.domains.length} 个域名的规则吗？这将覆盖现有的所有规则。`,
          okText: '导入',
          cancelText: '取消',
          onOk: async () => {
            try {
              // 为导入的规则生成新的ID
              const processedDomains = importData.domains.map((domain: any) => ({
                ...domain,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                rules: domain.rules.map((rule: any) => ({
                  ...rule,
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
                }))
              }));
              
              await saveDomains(processedDomains);
              setDomains(processedDomains);
              message.success('规则导入成功');
            } catch (error) {
              console.error('Import save failed:', error);
              message.error('导入保存失败');
            }
          }
        });
      } catch (error) {
        console.error('Import failed:', error);
        message.error('导入失败，请检查文件格式');
      }
    };
    input.click();
  };

  const domainColumns = [
    {
      title: '状态',
      dataIndex: 'on',
      key: 'on',
      width: 80,
      render: (on: boolean, record: Domain) => (
        <Switch
          checked={on}
          onChange={() => toggleDomain(record.id)}
          checkedChildren={<PlayCircleOutlined />}
          unCheckedChildren={<PauseCircleOutlined />}
        />
      ),
    },
    {
      title: '域名/URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
    },
    {
      title: '规则数量',
      dataIndex: 'rules',
      key: 'ruleCount',
      width: 100,
      render: (rules: Rule[]) => (
        <Tag color={rules.length > 0 ? 'blue' : 'default'}>
          {rules.length} 条
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (description: string) => description || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: Domain) => (
        <Space>
          <Tooltip title="编辑域名">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => openDomainModal(record)}
            />
          </Tooltip>
          <Tooltip title="添加规则">
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => openRuleModal(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="确定删除此域名？"
            onConfirm={() => deleteDomain(record.id)}
          >
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const expandedRowRender = (domain: Domain) => {
    const ruleColumns = [
      {
        title: '状态',
        dataIndex: 'on',
        key: 'on',
        width: 60,
        render: (on: boolean, rule: Rule) => (
          <Switch
            size="small"
            checked={on}
            onChange={() => toggleRule(domain.id, rule.id)}
          />
        ),
      },
      {
        title: '类型',
        dataIndex: 'type',
        key: 'type',
        width: 120,
        render: (type: string) => {
          const typeMap: Record<string, { color: string; text: string }> = {
            urlRedirect: { color: 'blue', text: 'URL重定向' },
            fileOverride: { color: 'green', text: '文件替换' },
            headerModification: { color: 'orange', text: '头部修改' },
            contentModification: { color: 'purple', text: '内容修改' },
          };
          const config = typeMap[type] || { color: 'default', text: type };
          return <Tag color={config.color}>{config.text}</Tag>;
        },
      },
      {
        title: '匹配规则',
        dataIndex: 'from',
        key: 'from',
        ellipsis: true,
      },
      {
        title: '目标',
        dataIndex: 'to',
        key: 'to',
        ellipsis: true,
        render: (to: string, rule: Rule) => to || rule.file || '-',
      },
      {
        title: '描述',
        dataIndex: 'description',
        key: 'description',
        ellipsis: true,
        render: (description: string) => description || '-',
      },
      {
        title: '操作',
        key: 'actions',
        width: 100,
        render: (_: any, rule: Rule) => (
          <Space>
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => openRuleModal(domain.id, rule)}
            />
            <Popconfirm
              title="确定删除此规则？"
              onConfirm={() => deleteRule(domain.id, rule.id)}
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Space>
        ),
      },
    ];

    return (
      <Table
        columns={ruleColumns}
        dataSource={domain.rules}
        pagination={false}
        size="small"
        rowKey="id"
        locale={{ emptyText: '暂无规则' }}
      />
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#fff', padding: '0 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space>
            <BugOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0 }}>
              Resource Override DevTools
            </Title>
          </Space>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openDomainModal()}
            >
              添加域名
            </Button>
            <Button
              icon={<UploadOutlined />}
              onClick={handleImportRules}
            >
              导入规则
            </Button>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportRules}
            >
              导出规则
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => chrome.runtime.openOptionsPage()}
            >
              设置
            </Button>
          </Space>
        </div>
      </Header>
      
      <Content style={{ padding: '24px' }}>
        <Card>
          <Table
            columns={domainColumns}
            dataSource={domains}
            loading={loading}
            rowKey="id"
            expandable={{
              expandedRowRender,
              expandIcon: ({ expanded, onExpand, record }) => (
                <Button
                  type="text"
                  size="small"
                  icon={<RightOutlined />}
                  onClick={e => onExpand(record, e)}
                  style={{ 
                    transform: expanded ? 'rotate(90deg)' : 'none',
                    transition: 'transform 0.2s ease'
                  }}
                />
              ),
            }}
            locale={{ emptyText: '暂无域名规则，点击"添加域名"开始配置' }}
          />
        </Card>
      </Content>

      {/* 域名编辑模态框 */}
      <Modal
        title={editingDomain ? '编辑域名' : '添加域名'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={() => form.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleDomainSubmit}
        >
          <Form.Item
            label="域名/URL匹配规则"
            name="url"
            rules={[{ required: true, message: '请输入域名或URL匹配规则' }]}
          >
            <Input placeholder="例如: *.example.com 或 https://example.com/*" />
          </Form.Item>
          <Form.Item
            label="描述"
            name="description"
          >
            <Input placeholder="域名描述（可选）" />
          </Form.Item>
          <Form.Item
            label="启用状态"
            name="on"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 规则编辑模态框 */}
      <Modal
        title={editingRule ? '编辑规则' : '添加规则'}
        open={ruleModalVisible}
        onCancel={() => setRuleModalVisible(false)}
        onOk={() => ruleForm.submit()}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form
          form={ruleForm}
          layout="vertical"
          onFinish={handleRuleSubmit}
        >
          <Form.Item
            label="规则类型"
            name="type"
            rules={[{ required: true, message: '请选择规则类型' }]}
          >
            <Select placeholder="选择规则类型">
              <Option value="urlRedirect">URL重定向</Option>
              <Option value="fileOverride">文件替换</Option>
              <Option value="headerModification">头部修改</Option>
              <Option value="contentModification">内容修改</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="匹配规则"
            name="from"
            rules={[{ required: true, message: '请输入匹配规则' }]}
          >
            <Input placeholder="要匹配的URL或路径" />
          </Form.Item>
          
          <Form.Item
            label="目标URL"
            name="to"
            dependencies={['type']}
            rules={[
              ({ getFieldValue }) => ({
                required: getFieldValue('type') === 'urlRedirect',
                message: '请输入目标URL',
              }),
            ]}
          >
            <Input placeholder="重定向的目标URL" />
          </Form.Item>
          
          <Form.Item
            label="文件内容"
            name="file"
            dependencies={['type']}
            rules={[
              ({ getFieldValue }) => ({
                required: getFieldValue('type') === 'fileOverride',
                message: '请输入文件内容',
              }),
            ]}
          >
            <Input.TextArea 
              rows={4} 
              placeholder="替换的文件内容" 
            />
          </Form.Item>
          
          <Form.Item
            label="文件类型"
            name="fileType"
            dependencies={['type']}
          >
            <Select placeholder="选择文件类型">
              <Option value="js">JavaScript</Option>
              <Option value="css">CSS</Option>
              <Option value="html">HTML</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            label="描述"
            name="description"
          >
            <Input placeholder="规则描述（可选）" />
          </Form.Item>
          
          <Form.Item
            label="启用状态"
            name="on"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
};

export default DevToolsApp; 
