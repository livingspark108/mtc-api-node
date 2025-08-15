import { Op, WhereOptions } from 'sequelize';
import Client from '../models/client.model';
import User from '../models/user.model';
import { ClientStatus } from '../utils/constants';

export interface ClientFilters {
  status?: ClientStatus;
  caId?: number;
  userId?: number;
  search?: string;
  onboardingCompleted?: boolean;
}

export interface ClientCreateData {
  userId: number;
  panNumber: string;
  aadharNumber?: string;
  dateOfBirth: Date;
  addressJson: any;
  occupation?: string;
  annualIncome?: number;
  status: ClientStatus;
  onboardingCompleted: boolean;
  profileJson?: any;
}

export interface ClientUpdateData {
  caId?: number | null;
  aadharNumber?: string;
  dateOfBirth?: Date;
  addressJson?: any;
  occupation?: string;
  annualIncome?: number;
  status?: ClientStatus;
  onboardingCompleted?: boolean;
  profileJson?: any;
}

export class ClientRepository {
  async create(clientData: ClientCreateData): Promise<Client> {
    return await Client.create(clientData);
  }

  async findById(id: number): Promise<Client | null> {
    return await Client.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'fullName', 'phone', 'role'],
        },
        {
          model: User,
          as: 'assignedCA',
          attributes: ['id', 'email', 'fullName', 'phone'],
          required: false,
        },
      ],
    });
  }

  async findByUserId(userId: number): Promise<Client | null> {
    return await Client.findOne({
      where: { userId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'fullName', 'phone', 'role'],
        },
        {
          model: User,
          as: 'assignedCA',
          attributes: ['id', 'email', 'fullName', 'phone'],
          required: false,
        },
      ],
    });
  }

  async findByPanNumber(panNumber: string): Promise<Client | null> {
    return await Client.findOne({
      where: { panNumber },
    });
  }

  async findAll(filters: ClientFilters = {}, limit = 50, offset = 0): Promise<{ clients: Client[]; total: number }> {
    const whereClause: WhereOptions = {};

    if (filters.status) {
      whereClause['status'] = filters.status;
    }

    if (filters.caId) {
      whereClause['caId'] = filters.caId;
    }

    if (filters.userId) {
      whereClause['userId'] = filters.userId;
    }

    if (typeof filters.onboardingCompleted === 'boolean') {
      whereClause['onboardingCompleted'] = filters.onboardingCompleted;
    }

    // Handle search in PAN number
    if (filters.search && filters.search.match(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)) {
      whereClause['panNumber'] = { [Op.like]: `%${filters.search}%` };
    }

    const includeClause = [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'email', 'fullName', 'phone', 'role'],
        ...(filters.search && !filters.search.match(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/) && {
          where: {
            [Op.or]: [
              { fullName: { [Op.like]: `%${filters.search}%` } },
              { email: { [Op.like]: `%${filters.search}%` } },
              { phone: { [Op.like]: `%${filters.search}%` } },
            ],
          },
        }),
      },
      {
        model: User,
        as: 'assignedCA',
        attributes: ['id', 'email', 'fullName', 'phone'],
        required: false,
      },
    ];

    const { count, rows } = await Client.findAndCountAll({
      where: whereClause,
      include: includeClause,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      clients: rows,
      total: count,
    };
  }

  async update(id: number, updateData: ClientUpdateData): Promise<Client | null> {
    // Create update object without null values for caId
    const cleanUpdateData: any = { ...updateData };
    if (updateData.caId === null) {
      cleanUpdateData.caId = undefined;
    }

    const [affectedRows] = await Client.update(cleanUpdateData, {
      where: { id },
    });

    if (affectedRows === 0) {
      return null;
    }

    return await this.findById(id);
  }

  async delete(id: number): Promise<boolean> {
    const deletedRows = await Client.destroy({
      where: { id },
    });

    return deletedRows > 0;
  }

  async assignCA(clientId: number, caId: number): Promise<Client | null> {
    const [affectedRows] = await Client.update(
      { caId },
      { where: { id: clientId } }
    );

    if (affectedRows === 0) {
      return null;
    }

    return await this.findById(clientId);
  }

  async unassignCA(clientId: number): Promise<Client | null> {
    const [affectedRows] = await Client.update(
      { caId: null as any },
      { where: { id: clientId } }
    );

    if (affectedRows === 0) {
      return null;
    }

    return await this.findById(clientId);
  }

  async findClientsByCA(caId: number): Promise<Client[]> {
    return await Client.findAll({
      where: { caId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'fullName', 'phone', 'role'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });
  }

  async countByStatus(status: ClientStatus): Promise<number> {
    return await Client.count({
      where: { status },
    });
  }

  async countByCA(caId: number): Promise<number> {
    return await Client.count({
      where: { caId },
    });
  }

  async findUnassignedClients(): Promise<Client[]> {
    return await Client.findAll({
      where: { 
        caId: undefined,
        status: 'active' 
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'fullName', 'phone', 'role'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });
  }

  async findIncompleteOnboarding(): Promise<Client[]> {
    return await Client.findAll({
      where: { onboardingCompleted: false },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'fullName', 'phone', 'role'],
        },
      ],
      order: [['createdAt', 'ASC']],
    });
  }

  async getTotalCount(): Promise<number> {
    return await Client.count();
  }
} 