import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer does not exists');
    }

    const productsInDatabase = await this.productsRepository.findAllById(
      products,
    );

    if (!productsInDatabase.length) {
      throw new AppError('Could not find any product with the given ids');
    }

    const productsInDatabaseIds = productsInDatabase.map(product => product.id);

    const checkInexistentProducts = products.filter(
      product => !productsInDatabaseIds.includes(product.id),
    );

    if (checkInexistentProducts.length) {
      throw new AppError(
        `Could not find product ${checkInexistentProducts[0].id}`,
      );
    }

    const findProductsWithInsufficientQuantity = products.filter(
      product =>
        productsInDatabase.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (findProductsWithInsufficientQuantity.length) {
      throw new AppError(
        `The quantity ${findProductsWithInsufficientQuantity[0]} is not available for ${findProductsWithInsufficientQuantity}`,
      );
    }

    const parsedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: productsInDatabase.filter(p => product.id === p.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: parsedProducts,
    });

    const orderedProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        productsInDatabase.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
