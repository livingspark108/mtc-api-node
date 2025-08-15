import { Op, WhereOptions, OrderItem } from 'sequelize';
import { Filing, Client, User } from '../models';
import { FilingStatus, FilingType, FilingPriority } from '../utils/constants';

export interface FilingFilters {
  page?: number;
  limit?: number;
  clientId?: number;
  caId?: number;
  assignedTo?: number;
  customerId?: number;
  status?: FilingStatus;
  filingType?: FilingType;
  priority?: FilingPriority;
  taxYear?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  dueDateFrom?: Date;
  dueDateTo?: Date;
}

export interface FilingCreateData {
  clientId: number;
  caId?: number;
  taxYear: string;
  filingType: FilingType;
  status?: FilingStatus;
  priority?: FilingPriority;
  incomeSourcesJson?: any;
  deductionsJson?: any;
  summaryJson?: any;
  notes?: string;
  dueDate?: Date;
}

export interface FilingUpdateData {
  caId?: number;
  status?: FilingStatus;
  priority?: FilingPriority;
  incomeSourcesJson?: any;
  deductionsJson?: any;
  summaryJson?: any;
  notes?: string;
  startedAt?: Date;
  completedAt?: Date;
  dueDate?: Date;
}

export interface FilingSearchResult {
  data: Filing[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class FilingRepository {
  async findAll(filters: FilingFilters = {}): Promise<FilingSearchResult> {
    const {
      page = 1,
      limit = 10,
      clientId,
      caId,
      assignedTo,
      customerId,
      status,
      filingType,
      priority,
      taxYear,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      dueDateFrom,
      dueDateTo,
    } = filters;

    const offset = (page - 1) * limit;
    const whereClause: WhereOptions = {};

    // Apply filters
    if (clientId) {
      whereClause.clientId = clientId;
    }

    if (caId) {
      whereClause.caId = caId;
    }

    if (assignedTo) {
      whereClause.caId = assignedTo;
    }

    if (customerId) {
      whereClause.clientId = customerId;
    }

    if (status) {
      whereClause.status = status;
    }

    if (filingType) {
      whereClause.filingType = filingType;
    }

    if (priority) {
      whereClause.priority = priority;
    }

    if (taxYear) {
      whereClause.taxYear = taxYear;
    }

    if (dueDateFrom || dueDateTo) {
      whereClause.dueDate = {};
      if (dueDateFrom) {
        whereClause.dueDate[Op.gte] = dueDateFrom;
      }
      if (dueDateTo) {
        whereClause.dueDate[Op.lte] = dueDateTo;
      }
    }

    // Search functionality
    if (search) {
      whereClause[Op.or as any] = [
        { taxYear: { [Op.like]: `%${search}%` } },
        { notes: { [Op.like]: `%${search}%` } },
        { '$client.user.fullName$': { [Op.like]: `%${search}%` } },
        { '$client.panNumber$': { [Op.like]: `%${search}%` } },
        { '$ca.fullName$': { [Op.like]: `%${search}%` } },
      ];
    }

    // Sorting
    const orderClause: OrderItem[] = [];
    if (sortBy === 'clientName') {
      orderClause.push([{ model: Client, as: 'client' }, { model: User, as: 'user' }, 'fullName', sortOrder]);
    } else if (sortBy === 'caName') {
      orderClause.push([{ model: User, as: 'ca' }, 'fullName', sortOrder]);
    } else {
      orderClause.push([sortBy, sortOrder]);
    }

    const { count, rows } = await Filing.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: 'client',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'fullName', 'email', 'phone'],
            },
          ],
        },
        {
          model: User,
          as: 'ca',
          attributes: ['id', 'fullName', 'email'],
          required: false,
        },
      ],
      offset,
      limit,
      order: orderClause,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limit);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findById(id: number): Promise<Filing | null> {
    return Filing.findByPk(id, {
      include: [
        {
          model: Client,
          as: 'client',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'fullName', 'email', 'phone'],
            },
          ],
        },
        {
          model: User,
          as: 'ca',
          attributes: ['id', 'fullName', 'email'],
          required: false,
        },
      ],
    });
  }

  async findByClientId(clientId: number, options: { limit?: number; status?: FilingStatus } = {}): Promise<Filing[]> {
    const { limit, status } = options;
    const whereClause: WhereOptions = { clientId };

    if (status) {
      whereClause.status = status;
    }

    return Filing.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'ca',
          attributes: ['id', 'fullName', 'email'],
          required: false,
        },
      ],
      order: [['createdAt', 'desc']],
      limit,
    });
  }

  async findByCAId(caId: number, options: { limit?: number; status?: FilingStatus } = {}): Promise<Filing[]> {
    const { limit, status } = options;
    const whereClause: WhereOptions = { caId };

    if (status) {
      whereClause.status = status;
    }

    return Filing.findAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: 'client',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'fullName', 'email', 'phone'],
            },
          ],
        },
      ],
      order: [['createdAt', 'desc']],
      limit,
    });
  }

  async create(data: FilingCreateData): Promise<Filing> {
    const createData = { 
      ...data, 
      status: data.status || 'draft' as any,
      priority: data.priority || 'medium' as any
    };
    const filing = await Filing.create(createData as any);
    return this.findById(filing.id) as Promise<Filing>;
  }

  async update(id: number, data: FilingUpdateData): Promise<Filing | null> {
    const [affectedCount] = await Filing.update(data, {
      where: { id },
    });

    if (affectedCount === 0) {
      return null;
    }

    return this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const affectedCount = await Filing.destroy({
      where: { id },
    });

    return affectedCount > 0;
  }

  async updateStatus(id: number, status: FilingStatus, notes?: string): Promise<Filing | null> {
    const updateData: FilingUpdateData = { status };
    
    if (notes) {
      updateData.notes = notes;
    }

    // Set timestamps based on status
    if (status === 'in_progress' && !await this.hasStatus(id, 'in_progress')) {
      updateData.startedAt = new Date();
    } else if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    return this.update(id, updateData);
  }

  async assignCA(id: number, caId: number): Promise<Filing | null> {
    return this.update(id, { caId });
  }

  async unassignCA(id: number): Promise<Filing | null> {
    return this.update(id, { caId: undefined });
  }

  async getFilingStats(options: { clientId?: number; caId?: number; taxYear?: string } = {}): Promise<{
    total: number;
    draft: number;
    inProgress: number;
    underReview: number;
    completed: number;
    rejected: number;
  }> {
    const { clientId, caId, taxYear } = options;
    const whereClause: WhereOptions = {};

    if (clientId) {
      whereClause.clientId = clientId;
    }

    if (caId) {
      whereClause.caId = caId;
    }

    if (taxYear) {
      whereClause.taxYear = taxYear;
    }

    const stats = await Filing.findAll({
      where: whereClause,
      attributes: [
        'status',
        [Filing.sequelize!.fn('COUNT', Filing.sequelize!.col('id')), 'count'],
      ],
      group: ['status'],
      raw: true,
    }) as any[];

    const result = {
      total: 0,
      draft: 0,
      inProgress: 0,
      underReview: 0,
      completed: 0,
      rejected: 0,
    };

    stats.forEach((stat: any) => {
      const count = parseInt(stat.count);
      result.total += count;
      
      switch (stat.status) {
        case 'draft':
          result.draft = count;
          break;
        case 'in_progress':
          result.inProgress = count;
          break;
        case 'under_review':
          result.underReview = count;
          break;
        case 'completed':
          result.completed = count;
          break;
        case 'rejected':
          result.rejected = count;
          break;
      }
    });

    return result;
  }

  async getUpcomingDeadlines(options: { days?: number; caId?: number; clientId?: number } = {}): Promise<Filing[]> {
    const { days = 30, caId, clientId } = options;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const whereClause: WhereOptions = {
      dueDate: {
        [Op.between]: [new Date(), futureDate],
      },
      status: {
        [Op.notIn]: ['completed', 'rejected'],
      },
    };

    if (caId) {
      whereClause.caId = caId;
    }

    if (clientId) {
      whereClause.clientId = clientId;
    }

    return Filing.findAll({
      where: whereClause,
      include: [
        {
          model: Client,
          as: 'client',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'fullName', 'email'],
            },
          ],
        },
        {
          model: User,
          as: 'ca',
          attributes: ['id', 'fullName', 'email'],
          required: false,
        },
      ],
      order: [['dueDate', 'asc']],
    });
  }

  private async hasStatus(id: number, status: FilingStatus): Promise<boolean> {
    const filing = await Filing.findByPk(id, { attributes: ['status'] });
    return filing?.status === status;
  }

  async getTotalCount(): Promise<number> {
    return await Filing.count();
  }
}

export default FilingRepository; 